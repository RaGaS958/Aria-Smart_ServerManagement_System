"""
ARIA backend test suite.
Run: pytest tests/ -v
"""
import pytest
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# ── Patch Mistral before importing app so no real key needed ──────────────────
import sys, os
os.environ.setdefault("MISTRAL_API_KEY", "sk-test-placeholder")

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app
from simulations.engine import SimulationEngine, SCENARIOS
from models.db import create_db

create_db()
client = TestClient(app)


# ── Health ─────────────────────────────────────────────────────────────────────
def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ── Scenarios ──────────────────────────────────────────────────────────────────
def test_list_scenarios():
    r = client.get("/sim/scenarios")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 5
    ids = {s["id"] for s in data}
    assert "cpu_spike" in ids
    assert "thermal_runaway" in ids
    assert "recovery" in ids


def test_trigger_scenario():
    r = client.post("/sim/trigger", json={"scenario": "cpu_spike", "severity": "high"})
    assert r.status_code == 200
    data = r.json()
    assert data["triggered"] is True
    assert data["scenario"] == "cpu_spike"
    assert data["mood"] == "panicked"


def test_trigger_unknown_scenario():
    r = client.post("/sim/trigger", json={"scenario": "does_not_exist"})
    assert r.status_code == 200
    data = r.json()
    assert "error" in data


def test_cancel_scenario():
    client.post("/sim/trigger", json={"scenario": "cpu_spike"})
    r = client.post("/sim/cancel")
    assert r.status_code == 200
    assert r.json()["cancelled"] is True


# ── Metrics snapshot ───────────────────────────────────────────────────────────
def test_metrics_snapshot():
    r = client.get("/metrics/snapshot")
    assert r.status_code == 200
    data = r.json()
    assert "nodes" in data
    assert "R1" in data["nodes"]
    assert "R2" in data["nodes"]
    assert "R3" in data["nodes"]
    for nid, m in data["nodes"].items():
        assert 0 <= m["cpu"] <= 100
        assert 0 <= m["ram"] <= 100
        assert 20 <= m["temp"] <= 110
        assert isinstance(m["healthy"], bool)


# ── Simulation engine unit tests ───────────────────────────────────────────────
def test_engine_initial_state():
    eng = SimulationEngine()
    snap = eng.snapshot()
    assert snap["scenario"] is None
    assert all(n in snap["nodes"] for n in ["R1","R2","R3"])


def test_engine_trigger_and_cancel():
    eng = SimulationEngine()
    assert eng.trigger("cpu_spike", "high") is True
    assert eng.active_scenario == "cpu_spike"
    eng.cancel()
    assert eng.active_scenario is None


def test_engine_invalid_scenario():
    eng = SimulationEngine()
    assert eng.trigger("nonexistent") is False


def test_engine_snapshot_with_scenario():
    eng = SimulationEngine()
    eng.trigger("thermal_runaway", "critical")
    snap = eng.snapshot()
    assert snap["scenario"] is not None
    assert snap["scenario"]["name"] == "thermal_runaway"
    assert snap["scenario"]["mood"] == "furious"


def test_engine_metrics_bounded():
    eng = SimulationEngine()
    eng.trigger("cpu_spike", "critical")
    for _ in range(20):
        snap = eng.snapshot()
        for nid, m in snap["nodes"].items():
            assert 0 <= m["cpu"] <= 100, f"{nid} CPU out of bounds: {m['cpu']}"
            assert 0 <= m["ram"] <= 100, f"{nid} RAM out of bounds: {m['ram']}"
            assert 20 <= m["temp"] <= 110, f"{nid} temp out of bounds: {m['temp']}"


# ── Tools ──────────────────────────────────────────────────────────────────────
def test_server_metrics_tool():
    from tools.all_tools import get_server_metrics
    result = get_server_metrics.invoke({"node": "R1"})
    assert "CPU" in result or "Could not" in result


def test_trigger_simulation_tool():
    from tools.all_tools import trigger_simulation
    import json
    result = trigger_simulation.invoke({"scenario": "recovery", "severity": "low"})
    data = json.loads(result)
    assert data["action"] == "trigger_simulation"
    assert data["scenario"] == "recovery"


def test_trigger_simulation_tool_invalid():
    from tools.all_tools import trigger_simulation
    result = trigger_simulation.invoke({"scenario": "invalid_scenario"})
    assert "Unknown scenario" in result


def test_datacenter_location_tool():
    from tools.all_tools import check_datacenter_location
    result = check_datacenter_location.invoke({"datacenter_id": "R1"})
    assert "Mumbai" in result
    assert "Tier" in result


def test_datacenter_location_unknown():
    from tools.all_tools import check_datacenter_location
    result = check_datacenter_location.invoke({"datacenter_id": "ZZ"})
    assert "Unknown" in result


# ── Chat history ───────────────────────────────────────────────────────────────
def test_chat_history_empty():
    r = client.get("/chat/history/nonexistent-session-xyz")
    assert r.status_code == 200
    assert r.json() == []


# ── Root ───────────────────────────────────────────────────────────────────────
def test_root():
    r = client.get("/")
    assert r.status_code == 200
    data = r.json()
    assert "ARIA" in data["name"]
    assert "docs" in data

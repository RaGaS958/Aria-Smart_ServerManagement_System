"""
╔══════════════════════════════════════════════════════════════════════════════╗
║            ARIA BACKEND — DEEP TEST SUITE                                  ║
║  Covers: latency, tools, edge cases, simulation engine, SSE, WebSocket,    ║
║          database, agent, metrics bounds, concurrency, error handling       ║
╚══════════════════════════════════════════════════════════════════════════════╝

Run all:        pytest tests/test_deep.py -v
Run with timing: pytest tests/test_deep.py -v --tb=short --durations=10
Run one section: pytest tests/test_deep.py -v -k "latency"
"""

import os, sys, json, time, asyncio, threading, uuid
from unittest.mock import patch, MagicMock, AsyncMock
from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest
import httpx
from fastapi.testclient import TestClient

# ── Env setup before imports ──────────────────────────────────────────────────
os.environ.setdefault("MISTRAL_API_KEY", "sk-test-placeholder")
os.environ.setdefault("OPENWEATHER_API_KEY", "ow-test-placeholder")
os.environ.setdefault("TAVILY_API_KEY", "tv-test-placeholder")

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app
from simulations.engine import SimulationEngine, SCENARIOS, ou_step, clamp, NodeState
from models.db import create_db, Message, ToolEvent, Conversation, engine as db_engine
from tools.all_tools import (
    get_weather, get_forecast, get_news,
    get_server_metrics, get_top_processes,
    trigger_simulation, check_datacenter_location,
    ALL_TOOLS, APPROVAL_REQUIRED,
)
from core.config import settings
from core.agent import (
    sse, extract_mood, resolve_approval,
    cleanup_approval, get_history, add_to_history, _histories,
)

create_db()
client = TestClient(app)

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1 — HEALTH & LATENCY
# ─────────────────────────────────────────────────────────────────────────────
class TestLatency:
    """All critical endpoints must respond under acceptable thresholds."""

    def _timed(self, method, url, **kwargs):
        t0 = time.perf_counter()
        r = getattr(client, method)(url, **kwargs)
        return r, (time.perf_counter() - t0) * 1000  # ms

    def test_health_under_50ms(self):
        r, ms = self._timed("get", "/health")
        assert r.status_code == 200
        assert ms < 50, f"Health took {ms:.1f}ms (limit 50ms)"

    def test_root_under_50ms(self):
        _, ms = self._timed("get", "/")
        assert ms < 50, f"Root took {ms:.1f}ms"

    def test_scenarios_list_under_100ms(self):
        _, ms = self._timed("get", "/sim/scenarios")
        assert ms < 100, f"Scenario list took {ms:.1f}ms (limit 100ms)"

    def test_metrics_snapshot_under_100ms(self):
        _, ms = self._timed("get", "/metrics/snapshot")
        assert ms < 100, f"Snapshot took {ms:.1f}ms (limit 100ms)"

    def test_sim_trigger_under_150ms(self):
        _, ms = self._timed("post", "/sim/trigger", json={"scenario": "recovery"})
        assert ms < 150, f"Trigger took {ms:.1f}ms (limit 150ms)"

    def test_sim_cancel_under_50ms(self):
        _, ms = self._timed("post", "/sim/cancel")
        assert ms < 50, f"Cancel took {ms:.1f}ms (limit 50ms)"

    def test_chat_history_under_100ms(self):
        _, ms = self._timed("get", "/chat/history/nonexistent")
        assert ms < 100, f"History took {ms:.1f}ms (limit 100ms)"

    def test_health_p99_under_80ms(self):
        """Run 20 health checks; 99th percentile must stay under 80ms."""
        times = []
        for _ in range(20):
            _, ms = self._timed("get", "/health")
            times.append(ms)
        times.sort()
        p99 = times[int(len(times) * 0.99)]
        assert p99 < 80, f"Health p99={p99:.1f}ms exceeds 80ms"

    def test_snapshot_under_concurrent_load(self):
        """5 concurrent snapshot requests — each must still respond under 200ms."""
        results = []

        def fetch():
            t0 = time.perf_counter()
            r = client.get("/metrics/snapshot")
            ms = (time.perf_counter() - t0) * 1000
            return r.status_code, ms

        with ThreadPoolExecutor(max_workers=5) as ex:
            futures = [ex.submit(fetch) for _ in range(5)]
            results = [f.result() for f in as_completed(futures)]

        for status, ms in results:
            assert status == 200
            assert ms < 200, f"Under load: snapshot took {ms:.1f}ms (limit 200ms)"


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2 — SIMULATION ENGINE (unit level)
# ─────────────────────────────────────────────────────────────────────────────
class TestSimulationEngine:
    """Deep tests for the OU-process engine, all scenarios, bounds."""

    def setup_method(self):
        self.eng = SimulationEngine()

    # ── OU process math ───────────────────────────────────────────────────────
    def test_ou_step_moves_toward_target(self):
        """After many steps, OU value should be close to target."""
        val = 20.0
        target = 80.0
        for _ in range(200):
            val = ou_step(val, target, theta=0.3, sigma=0.5, dt=0.5)
        assert 60 <= val <= 100, f"OU process didn't converge to target: {val}"

    def test_ou_step_with_zero_sigma_converges_exactly(self):
        """Zero noise → pure exponential convergence."""
        val = 0.0
        for _ in range(100):
            val = ou_step(val, 50.0, theta=0.5, sigma=0.0, dt=1.0)
        assert abs(val - 50.0) < 0.1, f"No-noise OU didn't converge: {val}"

    def test_clamp_boundaries(self):
        assert clamp(150, 0, 100) == 100
        assert clamp(-10, 0, 100) == 0
        assert clamp(50, 0, 100) == 50
        assert clamp(0, 0, 100) == 0
        assert clamp(100, 0, 100) == 100

    # ── Scenario validity ─────────────────────────────────────────────────────
    def test_all_scenarios_defined(self):
        expected = {"cpu_spike", "thermal_runaway", "network_partition", "memory_leak", "recovery"}
        assert set(SCENARIOS.keys()) == expected

    def test_every_scenario_has_required_keys(self):
        required = {"description", "affected_nodes", "duration_s", "phases", "mood", "alert"}
        for name, sc in SCENARIOS.items():
            missing = required - set(sc.keys())
            assert not missing, f"Scenario '{name}' missing keys: {missing}"

    def test_every_scenario_has_valid_mood(self):
        valid_moods = {
            "neutral","elated","resolute","shocked","puzzled",
            "melancholy","furious","panicked","adoring",
            "smile","retro","dreamy","sunny","calm"
        }
        for name, sc in SCENARIOS.items():
            assert sc["mood"] in valid_moods, f"'{name}' has invalid mood '{sc['mood']}'"

    def test_every_scenario_has_phases(self):
        for name, sc in SCENARIOS.items():
            assert len(sc["phases"]) >= 2, f"'{name}' needs at least 2 phases"
            for p in sc["phases"]:
                assert "t" in p, f"Phase in '{name}' missing 't' field"

    # ── Trigger / cancel ──────────────────────────────────────────────────────
    def test_trigger_all_scenarios(self):
        for name in SCENARIOS:
            eng = SimulationEngine()
            assert eng.trigger(name) is True
            assert eng.active_scenario == name

    def test_trigger_unknown_returns_false(self):
        assert self.eng.trigger("definitely_not_real") is False
        assert self.eng.active_scenario is None

    def test_cancel_clears_state(self):
        self.eng.trigger("cpu_spike")
        self.eng.cancel()
        assert self.eng.active_scenario is None
        snap = self.eng.snapshot()
        assert snap["scenario"] is None

    def test_double_cancel_is_safe(self):
        self.eng.cancel()
        self.eng.cancel()  # should not raise

    def test_retrigger_replaces_scenario(self):
        self.eng.trigger("cpu_spike")
        self.eng.trigger("recovery")
        assert self.eng.active_scenario == "recovery"

    # ── Metrics bounds after many ticks ───────────────────────────────────────
    @pytest.mark.parametrize("scenario", list(SCENARIOS.keys()))
    def test_metrics_always_in_bounds(self, scenario):
        """All metrics stay within physical limits through the full scenario."""
        eng = SimulationEngine()
        eng.trigger(scenario, "critical")
        violations = []
        for tick in range(300):
            snap = eng.snapshot()
            for nid, m in snap["nodes"].items():
                if not (0 <= m["cpu"] <= 100):
                    violations.append(f"tick={tick} {nid}.cpu={m['cpu']}")
                if not (0 <= m["ram"] <= 100):
                    violations.append(f"tick={tick} {nid}.ram={m['ram']}")
                if not (20 <= m["temp"] <= 110):
                    violations.append(f"tick={tick} {nid}.temp={m['temp']}")
                if not (0 <= m["net_in"] <= 1000):
                    violations.append(f"tick={tick} {nid}.net_in={m['net_in']}")
        assert not violations, f"Bounds violated: {violations[:5]}"

    def test_scenario_auto_expires(self):
        """After duration_s ticks the scenario should clear itself."""
        eng = SimulationEngine()
        eng.trigger("recovery")                   # duration = 60s
        eng.scenario_start = time.time() - 999   # fake: started long ago
        snap = eng.snapshot()
        assert snap["scenario"] is None, "Scenario should have expired"

    def test_healthy_flag_flips_on_spike(self):
        """cpu_spike at critical should eventually mark R2 as unhealthy."""
        eng = SimulationEngine()
        eng.trigger("cpu_spike", "critical")
        # Manually push CPU very high on R2 to force unhealthy
        eng.nodes["R2"].cpu = 95.0
        eng.nodes["R2"].temp = 88.0
        snap = eng.snapshot()
        assert snap["nodes"]["R2"]["healthy"] is False

    # ── Subscribe / broadcast ─────────────────────────────────────────────────
    def test_subscribe_returns_queue(self):
        q = self.eng.subscribe()
        assert q is not None
        self.eng.unsubscribe(q)

    def test_unsubscribe_removes_queue(self):
        q = self.eng.subscribe()
        assert q in self.eng._subscribers
        self.eng.unsubscribe(q)
        assert q not in self.eng._subscribers

    def test_multiple_subscribers(self):
        queues = [self.eng.subscribe() for _ in range(5)]
        assert len(self.eng._subscribers) == 5
        for q in queues:
            self.eng.unsubscribe(q)
        assert len(self.eng._subscribers) == 0


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3 — REST API (endpoints)
# ─────────────────────────────────────────────────────────────────────────────
class TestSimEndpoints:

    def setup_method(self):
        client.post("/sim/cancel")  # clean slate

    def test_health_response_shape(self):
        r = client.get("/health")
        assert r.json() == {"status": "ok", "service": "ARIA Core API"}

    def test_root_response_shape(self):
        data = client.get("/").json()
        assert "name" in data and "ARIA" in data["name"]
        assert "docs" in data and "version" in data

    def test_scenarios_response_shape(self):
        data = client.get("/sim/scenarios").json()
        assert isinstance(data, list) and len(data) == 5
        for s in data:
            assert all(k in s for k in ["id", "description", "duration_s", "mood", "alert"])

    def test_trigger_all_valid_scenarios(self):
        for name in SCENARIOS:
            client.post("/sim/cancel")
            r = client.post("/sim/trigger", json={"scenario": name, "severity": "medium"})
            assert r.status_code == 200
            assert r.json()["triggered"] is True

    def test_trigger_all_severity_levels(self):
        for severity in ["low", "medium", "high", "critical"]:
            r = client.post("/sim/trigger", json={"scenario": "recovery", "severity": severity})
            assert r.status_code == 200

    def test_trigger_invalid_scenario_returns_error(self):
        r = client.post("/sim/trigger", json={"scenario": "fake_scenario"})
        assert r.status_code == 200
        assert "error" in r.json()

    def test_trigger_missing_body_returns_422(self):
        r = client.post("/sim/trigger", json={})
        assert r.status_code == 422

    def test_trigger_empty_scenario_string(self):
        r = client.post("/sim/trigger", json={"scenario": ""})
        assert "error" in r.json() or r.status_code in [200, 422]

    def test_cancel_when_nothing_active(self):
        client.post("/sim/cancel")
        r = client.post("/sim/cancel")  # double cancel
        assert r.status_code == 200 and r.json()["cancelled"] is True

    def test_metrics_snapshot_shape(self):
        r = client.get("/metrics/snapshot")
        data = r.json()
        assert "ts" in data and "nodes" in data
        assert set(data["nodes"].keys()) == {"R1", "R2", "R3"}

    def test_metrics_snapshot_node_keys(self):
        data = client.get("/metrics/snapshot").json()
        required = {"cpu", "ram", "temp", "net_in", "net_out", "disk_io", "healthy"}
        for nid, m in data["nodes"].items():
            missing = required - set(m.keys())
            assert not missing, f"{nid} missing keys: {missing}"

    def test_metrics_snapshot_types(self):
        data = client.get("/metrics/snapshot").json()
        for nid, m in data["nodes"].items():
            assert isinstance(m["cpu"], (int, float)), f"{nid}.cpu wrong type"
            assert isinstance(m["ram"], (int, float))
            assert isinstance(m["temp"], (int, float))
            assert isinstance(m["healthy"], bool)

    def test_metrics_snapshot_values_in_range(self):
        data = client.get("/metrics/snapshot").json()
        for nid, m in data["nodes"].items():
            assert 0 <= m["cpu"] <= 100, f"{nid}.cpu={m['cpu']}"
            assert 0 <= m["ram"] <= 100
            assert 20 <= m["temp"] <= 110

    def test_snapshot_reflects_active_scenario(self):
        client.post("/sim/trigger", json={"scenario": "thermal_runaway"})
        time.sleep(0.1)
        data = client.get("/metrics/snapshot").json()
        assert data["scenario"] is not None
        assert data["scenario"]["name"] == "thermal_runaway"
        assert data["scenario"]["mood"] == "furious"
        assert "elapsed" in data["scenario"]
        assert "duration" in data["scenario"]

    def test_snapshot_scenario_none_after_cancel(self):
        client.post("/sim/trigger", json={"scenario": "cpu_spike"})
        client.post("/sim/cancel")
        data = client.get("/metrics/snapshot").json()
        assert data["scenario"] is None

    def test_http_methods_not_allowed(self):
        assert client.delete("/health").status_code == 405
        assert client.put("/sim/cancel").status_code == 405
        assert client.get("/sim/trigger").status_code == 405

    def test_unknown_route_returns_404(self):
        assert client.get("/does/not/exist").status_code == 404

    def test_approve_unknown_call_id(self):
        r = client.post("/chat/approve", json={"call_id": "nope", "approved": True})
        assert r.status_code == 200
        assert r.json()["success"] is False

    def test_approve_both_decisions(self):
        for approved in [True, False]:
            r = client.post("/chat/approve", json={"call_id": "x", "approved": approved})
            assert r.status_code == 200

    def test_chat_history_empty_session(self):
        r = client.get(f"/chat/history/{uuid.uuid4()}")
        assert r.status_code == 200
        assert r.json() == []

    def test_chat_history_invalid_chars_in_session(self):
        """Session IDs with special chars should not crash the server."""
        r = client.get("/chat/history/../../etc/passwd")
        assert r.status_code in [200, 404, 422]


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4 — TOOLS (unit level, no real API calls)
# ─────────────────────────────────────────────────────────────────────────────
class TestToolsUnit:

    # ── Weather ───────────────────────────────────────────────────────────────
    def test_weather_no_api_key_graceful(self):
        with patch.object(settings, "openweather_api_key", ""):
            result = get_weather.invoke({"city": "London"})
            assert "not configured" in result.lower() or "api key" in result.lower()

    def test_weather_http_error_handled(self):
        with patch("tools.all_tools.requests.get") as mock_get:
            mock_get.return_value.status_code = 500
            with patch.object(settings, "openweather_api_key", "fake-key"):
                result = get_weather.invoke({"city": "London"})
                assert "status 500" in result or "could not" in result.lower()

    def test_weather_200_parses_correctly(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "weather": [{"description": "clear sky"}],
            "main": {"temp": 28.5, "feels_like": 27.0, "humidity": 55},
            "wind": {"speed": 3.2},
        }
        with patch("tools.all_tools.requests.get", return_value=mock_resp):
            with patch.object(settings, "openweather_api_key", "fake-key"):
                result = get_weather.invoke({"city": "Mumbai"})
                assert "28.5" in result
                assert "clear sky" in result
                assert "Mumbai" in result

    def test_weather_city_with_spaces(self):
        with patch.object(settings, "openweather_api_key", ""):
            result = get_weather.invoke({"city": "New York"})
            assert isinstance(result, str) and len(result) > 0

    def test_weather_unicode_city(self):
        with patch.object(settings, "openweather_api_key", ""):
            result = get_weather.invoke({"city": "東京"})
            assert isinstance(result, str)

    def test_weather_empty_city(self):
        with patch.object(settings, "openweather_api_key", "fake"):
            with patch("tools.all_tools.requests.get") as mock_get:
                mock_get.return_value.status_code = 404
                result = get_weather.invoke({"city": ""})
                assert isinstance(result, str)

    def test_forecast_no_api_key(self):
        with patch.object(settings, "openweather_api_key", ""):
            result = get_forecast.invoke({"city": "Delhi"})
            assert "not configured" in result.lower()

    def test_forecast_200_returns_multiple_entries(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "list": [
                {"dt_txt": "2024-01-01 00:00:00", "weather": [{"description": "rain"}], "main": {"temp": 22.0}},
                {"dt_txt": "2024-01-01 03:00:00", "weather": [{"description": "cloudy"}], "main": {"temp": 20.0}},
            ]
        }
        with patch("tools.all_tools.requests.get", return_value=mock_resp):
            with patch.object(settings, "openweather_api_key", "fake"):
                result = get_forecast.invoke({"city": "Pune"})
                assert "2024-01-01" in result
                assert "rain" in result

    # ── News ──────────────────────────────────────────────────────────────────
    def test_news_no_api_key(self):
        with patch.object(settings, "tavily_api_key", ""):
            result = get_news.invoke({"query": "Mumbai"})
            assert "not configured" in result.lower()

    def test_news_empty_results_handled(self):
        mock_client = MagicMock()
        mock_client.search.return_value = {"results": []}
        with patch("tools.all_tools._tavily", mock_client):
            with patch.object(settings, "tavily_api_key", "fake"):
                result = get_news.invoke({"query": "nonexistent place 99999"})
                assert "no news found" in result.lower()

    def test_news_formats_correctly(self):
        mock_client = MagicMock()
        mock_client.search.return_value = {
            "results": [
                {"title": "Test Headline", "url": "https://example.com", "content": "Test content here."},
            ]
        }
        with patch("tools.all_tools._tavily", mock_client):
            with patch.object(settings, "tavily_api_key", "fake"):
                result = get_news.invoke({"query": "test"})
                assert "Test Headline" in result
                assert "https://example.com" in result

    def test_news_truncates_long_content(self):
        long_content = "x" * 500
        mock_client = MagicMock()
        mock_client.search.return_value = {
            "results": [{"title": "T", "url": "u", "content": long_content}]
        }
        with patch("tools.all_tools._tavily", mock_client):
            with patch.object(settings, "tavily_api_key", "fake"):
                result = get_news.invoke({"query": "q"})
                # Should truncate content (150 chars + "...")
                assert len(result) < len(long_content) + 200

    # ── Server metrics ────────────────────────────────────────────────────────
    def test_server_metrics_returns_string(self):
        result = get_server_metrics.invoke({"node": "R1"})
        assert isinstance(result, str) and len(result) > 0

    def test_server_metrics_contains_fields(self):
        result = get_server_metrics.invoke({"node": "all"})
        # Either real data or graceful error
        assert any(k in result for k in ["CPU", "RAM", "Disk", "Could not"])

    def test_server_metrics_psutil_failure_handled(self):
        # psutil is imported inside the function body, so patch at the psutil module level
        with patch("psutil.cpu_percent", side_effect=Exception("psutil error")):
            result = get_server_metrics.invoke({"node": "R1"})
            assert "Could not" in result or "error" in result.lower()

    def test_server_metrics_mock_real_data(self):
        import psutil as _psutil
        with patch.object(_psutil, "cpu_percent", return_value=42.5), \
             patch.object(_psutil, "virtual_memory", return_value=MagicMock(percent=67.3, used=4*1024**3, total=8*1024**3)), \
             patch.object(_psutil, "disk_usage", return_value=MagicMock(percent=55.0)), \
             patch.object(_psutil, "net_io_counters", return_value=MagicMock(bytes_sent=1024*1024, bytes_recv=2*1024*1024)):
            result = get_server_metrics.invoke({"node": "R2"})
            assert "42.5" in result
            assert "67.3" in result

    def test_top_processes_returns_list(self):
        result = get_top_processes.invoke({"limit": 3})
        assert isinstance(result, str)

    def test_top_processes_respects_limit(self):
        import psutil as _psutil
        procs = [
            MagicMock(info={"pid": i, "name": f"proc{i}", "cpu_percent": float(i), "memory_percent": 1.0})
            for i in range(10)
        ]
        with patch.object(_psutil, "process_iter", return_value=procs):
            result = get_top_processes.invoke({"limit": 3})
            assert result.count("PID") <= 3

    def test_top_processes_dead_process_skipped(self):
        """Processes that die mid-iteration should be silently skipped."""
        import psutil as _psutil
        live = MagicMock(info={"pid": 1, "name": "ok", "cpu_percent": 5.0, "memory_percent": 1.0})
        dead = MagicMock()
        dead.info = MagicMock(side_effect=_psutil.NoSuchProcess(999))
        with patch.object(_psutil, "process_iter", return_value=[live, dead]):
            result = get_top_processes.invoke({"limit": 5})
            assert isinstance(result, str)

    # ── Sim trigger tool ──────────────────────────────────────────────────────
    def test_trigger_sim_tool_returns_json(self):
        result = trigger_simulation.invoke({"scenario": "cpu_spike", "severity": "high"})
        data = json.loads(result)
        assert data["action"] == "trigger_simulation"
        assert data["status"] == "queued"

    def test_trigger_sim_all_valid_scenarios(self):
        for name in ["cpu_spike", "thermal_runaway", "network_partition", "memory_leak", "recovery"]:
            result = trigger_simulation.invoke({"scenario": name, "severity": "medium"})
            data = json.loads(result)
            assert data["scenario"] == name

    def test_trigger_sim_all_severities(self):
        for sev in ["low", "medium", "high", "critical"]:
            result = trigger_simulation.invoke({"scenario": "recovery", "severity": sev})
            data = json.loads(result)
            assert data["severity"] == sev

    def test_trigger_sim_invalid_scenario(self):
        result = trigger_simulation.invoke({"scenario": "hack_everything"})
        assert "Unknown scenario" in result

    def test_trigger_sim_invalid_severity(self):
        result = trigger_simulation.invoke({"scenario": "recovery", "severity": "extreme"})
        assert "Unknown severity" in result

    def test_trigger_sim_empty_scenario(self):
        result = trigger_simulation.invoke({"scenario": ""})
        assert "Unknown scenario" in result

    # ── Datacenter location ───────────────────────────────────────────────────
    def test_datacenter_r1(self):
        r = check_datacenter_location.invoke({"datacenter_id": "R1"})
        assert "Mumbai" in r and "Tier" in r

    def test_datacenter_r2(self):
        r = check_datacenter_location.invoke({"datacenter_id": "R2"})
        assert "Delhi" in r

    def test_datacenter_r3(self):
        r = check_datacenter_location.invoke({"datacenter_id": "R3"})
        assert "Pune" in r

    def test_datacenter_case_insensitive(self):
        r = check_datacenter_location.invoke({"datacenter_id": "r1"})
        assert "Mumbai" in r

    def test_datacenter_unknown_id(self):
        r = check_datacenter_location.invoke({"datacenter_id": "ZZ"})
        assert "Unknown" in r

    def test_datacenter_empty_id(self):
        r = check_datacenter_location.invoke({"datacenter_id": ""})
        assert isinstance(r, str) and len(r) > 0

    def test_datacenter_numeric_id(self):
        r = check_datacenter_location.invoke({"datacenter_id": "123"})
        assert "Unknown" in r

    def test_datacenter_sql_injection_attempt(self):
        r = check_datacenter_location.invoke({"datacenter_id": "'; DROP TABLE--"})
        assert isinstance(r, str)  # should not crash

    # ── Tool registry ─────────────────────────────────────────────────────────
    def test_all_tools_count(self):
        assert len(ALL_TOOLS) == 7

    def test_all_tools_have_names(self):
        for t in ALL_TOOLS:
            assert hasattr(t, "name") and t.name

    def test_all_tools_have_descriptions(self):
        for t in ALL_TOOLS:
            assert hasattr(t, "description") and len(t.description) > 10

    def test_approval_required_set_is_valid(self):
        tool_names = {t.name for t in ALL_TOOLS}
        for name in APPROVAL_REQUIRED:
            assert name in tool_names, f"'{name}' in APPROVAL_REQUIRED but not in ALL_TOOLS"


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 5 — AGENT CORE (unit level)
# ─────────────────────────────────────────────────────────────────────────────
class TestAgentCore:

    def test_sse_format_correct(self):
        out = sse("token", {"text": "hello"})
        assert out.startswith("event: token\n")
        assert 'data: {"text": "hello"}' in out
        assert out.endswith("\n\n")

    def test_sse_with_nested_data(self):
        out = sse("done", {"text": "ok", "mood": "calm", "session_id": "abc"})
        data = json.loads(out.split("data: ")[1].strip())
        assert data["mood"] == "calm"

    def test_conversation_history_stored(self):
        from langchain_core.messages import HumanMessage, AIMessage
        sid = str(uuid.uuid4())
        add_to_history(sid, HumanMessage(content="hello"))
        add_to_history(sid, AIMessage(content="hi there"))
        h = get_history(sid)
        assert len(h) == 2

    def test_conversation_history_max_20(self):
        from langchain_core.messages import HumanMessage
        sid = str(uuid.uuid4())
        for i in range(30):
            add_to_history(sid, HumanMessage(content=f"msg {i}"))
        h = get_history(sid)
        assert len(h) <= 20, f"History exceeded 20 messages: {len(h)}"

    def test_conversation_history_isolated_by_session(self):
        from langchain_core.messages import HumanMessage
        sid1, sid2 = str(uuid.uuid4()), str(uuid.uuid4())
        add_to_history(sid1, HumanMessage(content="session 1 message"))
        h2 = get_history(sid2)
        assert not any("session 1 message" in str(m) for m in h2)

    def test_resolve_approval_unknown_id(self):
        assert resolve_approval("nonexistent-id", True) is False

    def test_cleanup_approval_safe_unknown(self):
        cleanup_approval("does-not-exist")  # should not raise

    @pytest.mark.asyncio
    async def test_extract_mood_returns_valid(self):
        mock_llm = AsyncMock()
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(
            content='{"mood": "elated", "reason": "positive message"}'
        ))
        result = await extract_mood("Everything is working great!", mock_llm)
        assert result["mood"] == "elated"
        assert "reason" in result

    @pytest.mark.asyncio
    async def test_extract_mood_malformed_json_fallback(self):
        mock_llm = AsyncMock()
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="not json at all"))
        result = await extract_mood("test", mock_llm)
        assert result["mood"] == "neutral"  # fallback

    @pytest.mark.asyncio
    async def test_extract_mood_llm_exception_fallback(self):
        mock_llm = AsyncMock()
        mock_llm.ainvoke = AsyncMock(side_effect=Exception("LLM error"))
        result = await extract_mood("test", mock_llm)
        assert result["mood"] == "neutral"

    @pytest.mark.asyncio
    async def test_extract_mood_with_markdown_fences(self):
        mock_llm = AsyncMock()
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(
            content='```json\n{"mood": "calm", "reason": "serene"}\n```'
        ))
        result = await extract_mood("All is quiet.", mock_llm)
        assert result["mood"] == "calm"

    @pytest.mark.asyncio
    async def test_stream_agent_response_no_key_returns_error(self):
        """Without a real Mistral key, agent should emit error SSE, not crash."""
        from core.agent import stream_agent_response
        chunks = []
        async for chunk in stream_agent_response("hello", "test-session"):
            chunks.append(chunk)
        combined = "".join(chunks)
        # Must emit at least one SSE event, and finish cleanly
        assert "event:" in combined
        assert combined.endswith("\n\n")

    @pytest.mark.asyncio
    async def test_stream_agent_all_events_valid_sse(self):
        """Every emitted chunk must be valid SSE format."""
        from core.agent import stream_agent_response
        async for chunk in stream_agent_response("test", "s1"):
            assert "\n\n" in chunk, f"Chunk not valid SSE: {repr(chunk)}"
            assert chunk.startswith("event:"), f"Missing event: {repr(chunk)}"
            lines = chunk.strip().split("\n")
            assert any(l.startswith("data:") for l in lines), f"Missing data: {repr(chunk)}"


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 6 — DATABASE
# ─────────────────────────────────────────────────────────────────────────────
class TestDatabase:
    from sqlmodel import Session as _Session

    def _session(self):
        from sqlmodel import Session
        return Session(db_engine)

    def test_message_insert_and_retrieve(self):
        sid = str(uuid.uuid4())
        with self._session() as s:
            s.add(Message(session_id=sid, role="user", content="hello db"))
            s.commit()
        with self._session() as s:
            from sqlmodel import select
            msgs = s.exec(select(Message).where(Message.session_id == sid)).all()
            assert len(msgs) == 1
            assert msgs[0].content == "hello db"

    def test_message_mood_nullable(self):
        sid = str(uuid.uuid4())
        with self._session() as s:
            s.add(Message(session_id=sid, role="aria", content="hi", mood=None))
            s.commit()
        with self._session() as s:
            from sqlmodel import select
            m = s.exec(select(Message).where(Message.session_id == sid)).first()
            assert m.mood is None

    def test_multiple_sessions_isolated(self):
        sid1, sid2 = str(uuid.uuid4()), str(uuid.uuid4())
        with self._session() as s:
            s.add(Message(session_id=sid1, role="user", content="s1"))
            s.add(Message(session_id=sid2, role="user", content="s2"))
            s.commit()
        with self._session() as s:
            from sqlmodel import select
            r1 = s.exec(select(Message).where(Message.session_id == sid1)).all()
            r2 = s.exec(select(Message).where(Message.session_id == sid2)).all()
            assert len(r1) == 1 and r1[0].content == "s1"
            assert len(r2) == 1 and r2[0].content == "s2"

    def test_tool_event_insert(self):
        with self._session() as s:
            s.add(ToolEvent(
                session_id="test",
                tool_name="get_weather",
                tool_args='{"city":"Mumbai"}',
                tool_result="28°C",
                approved=True,
            ))
            s.commit()

    def test_chat_history_endpoint_returns_db_messages(self):
        sid = str(uuid.uuid4())
        with self._session() as s:
            s.add(Message(session_id=sid, role="user", content="from db"))
            s.add(Message(session_id=sid, role="aria", content="reply", mood="calm"))
            s.commit()
        r = client.get(f"/chat/history/{sid}")
        data = r.json()
        assert len(data) == 2
        assert data[0]["content"] == "from db"
        assert data[1]["mood"] == "calm"

    def test_message_timestamp_auto_set(self):
        sid = str(uuid.uuid4())
        with self._session() as s:
            s.add(Message(session_id=sid, role="user", content="ts test"))
            s.commit()
        with self._session() as s:
            from sqlmodel import select
            m = s.exec(select(Message).where(Message.session_id == sid)).first()
            assert m.created_at is not None


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 7 — CONFIG & SETTINGS
# ─────────────────────────────────────────────────────────────────────────────
class TestConfig:

    def test_settings_loads_without_env_file(self):
        assert settings is not None

    def test_sim_mode_is_bool(self):
        assert isinstance(settings.sim_mode, bool)

    def test_database_url_is_string(self):
        assert isinstance(settings.database_url, str)
        assert "sqlite" in settings.database_url or "postgresql" in settings.database_url

    def test_cors_origins_parseable(self):
        origins = [o.strip() for o in settings.cors_origins.split(",")]
        assert len(origins) >= 1

    def test_mistral_key_is_set(self):
        # In test env we set a placeholder
        assert settings.mistral_api_key != ""


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 8 — CONCURRENCY & STRESS
# ─────────────────────────────────────────────────────────────────────────────
class TestConcurrency:

    def test_rapid_trigger_cancel_cycles(self):
        """Rapidly trigger and cancel 20 times — no crashes, no state corruption."""
        for i in range(20):
            names = list(SCENARIOS.keys())
            name = names[i % len(names)]
            r1 = client.post("/sim/trigger", json={"scenario": name})
            r2 = client.post("/sim/cancel")
            assert r1.status_code == 200
            assert r2.status_code == 200

    def test_concurrent_snapshot_requests(self):
        """10 concurrent snapshot requests — all must succeed."""
        def fetch():
            return client.get("/metrics/snapshot").status_code

        with ThreadPoolExecutor(max_workers=10) as ex:
            futures = [ex.submit(fetch) for _ in range(10)]
            results = [f.result() for f in as_completed(futures)]
        assert all(s == 200 for s in results), f"Some requests failed: {results}"

    def test_concurrent_scenario_triggers(self):
        """Multiple threads triggering scenarios — last one wins, no crash."""
        results = []
        def trigger(name):
            r = client.post("/sim/trigger", json={"scenario": name, "severity": "low"})
            return r.status_code

        names = list(SCENARIOS.keys()) * 2
        with ThreadPoolExecutor(max_workers=5) as ex:
            futures = [ex.submit(trigger, n) for n in names]
            results = [f.result() for f in as_completed(futures)]
        assert all(s == 200 for s in results)
        client.post("/sim/cancel")

    def test_engine_subscription_concurrent(self):
        """Multiple subscribers + snapshot calls from different threads."""
        eng = SimulationEngine()
        eng.trigger("cpu_spike")
        queues = [eng.subscribe() for _ in range(10)]

        errors = []
        def do_snapshot():
            try:
                for _ in range(5):
                    eng.snapshot()
            except Exception as e:
                errors.append(str(e))

        threads = [threading.Thread(target=do_snapshot) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f"Errors in concurrent snapshot: {errors}"
        for q in queues:
            eng.unsubscribe(q)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 9 — EDGE CASES & ADVERSARIAL INPUTS
# ─────────────────────────────────────────────────────────────────────────────
class TestEdgeCases:

    def test_very_long_session_id(self):
        long_id = "a" * 500
        r = client.get(f"/chat/history/{long_id}")
        assert r.status_code in [200, 404, 422]

    def test_null_bytes_in_request(self):
        r = client.post("/sim/trigger", json={"scenario": "cpu_spike\x00", "severity": "low"})
        assert r.status_code in [200, 422]

    def test_very_large_json_body(self):
        big = {"scenario": "recovery", "severity": "low", "extra": "x" * 10_000}
        r = client.post("/sim/trigger", json=big)
        assert r.status_code in [200, 422]

    def test_unicode_in_chat_message(self):
        r = client.post("/chat/stream",
            json={"message": "नमस्ते ARIA, सर्वर की स्थिति बताओ", "session_id": "unicode-test"},
            headers={"Accept": "text/event-stream"},
        )
        # May not complete without real key, but must not crash
        assert r.status_code in [200, 500]

    def test_emoji_in_message(self):
        r = client.post("/chat/stream",
            json={"message": "🔥 server on fire! 🚨", "session_id": "emoji-test"},
        )
        assert r.status_code in [200, 500]

    def test_inject_attempt_in_city(self):
        with patch.object(settings, "openweather_api_key", ""):
            result = get_weather.invoke({"city": "; rm -rf /"})
            assert isinstance(result, str)  # no crash, just a string

    def test_node_state_created_correctly(self):
        n = NodeState("R99", cpu=50, ram=60, temp=55)
        assert n.node_id == "R99"
        assert n.cpu == 50
        assert n.healthy is True

    def test_sse_helper_escapes_quotes(self):
        out = sse("test", {"text": 'say "hello"'})
        # json.dumps should handle escaping
        assert '"' in out or '\\"' in out

    def test_metrics_never_nan(self):
        """NaN in metrics would break the frontend charts."""
        import math
        eng = SimulationEngine()
        eng.trigger("thermal_runaway", "critical")
        for _ in range(50):
            snap = eng.snapshot()
            for nid, m in snap["nodes"].items():
                for key in ["cpu", "ram", "temp", "net_in", "net_out", "disk_io"]:
                    assert not math.isnan(m[key]), f"{nid}.{key} is NaN"
                    assert not math.isinf(m[key]), f"{nid}.{key} is Inf"


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 10 — INTEGRATION (multi-step flows)
# ─────────────────────────────────────────────────────────────────────────────
class TestIntegrationFlows:

    def test_full_incident_lifecycle(self):
        """Trigger → verify active → check metrics → cancel → verify cleared."""
        client.post("/sim/cancel")

        # 1. Trigger
        r = client.post("/sim/trigger", json={"scenario": "memory_leak", "severity": "high"})
        assert r.json()["triggered"] is True

        # 2. Verify active in snapshot
        snap = client.get("/metrics/snapshot").json()
        assert snap["scenario"]["name"] == "memory_leak"
        assert snap["scenario"]["mood"] == "melancholy"

        # 3. Cancel
        client.post("/sim/cancel")

        # 4. Verify cleared
        snap = client.get("/metrics/snapshot").json()
        assert snap["scenario"] is None

    def test_scenario_mood_matches_expected(self):
        expected_moods = {
            "cpu_spike": "panicked",
            "thermal_runaway": "furious",
            "network_partition": "shocked",
            "memory_leak": "melancholy",
            "recovery": "elated",
        }
        for scenario, expected_mood in expected_moods.items():
            client.post("/sim/cancel")
            r = client.post("/sim/trigger", json={"scenario": scenario})
            assert r.json()["mood"] == expected_mood, \
                f"{scenario}: expected mood '{expected_mood}', got '{r.json()['mood']}'"

    def test_scenarios_list_matches_engine(self):
        api_ids = {s["id"] for s in client.get("/sim/scenarios").json()}
        engine_ids = set(SCENARIOS.keys())
        assert api_ids == engine_ids

    def test_metrics_snapshot_ts_increases(self):
        """Timestamps must be monotonically increasing."""
        t1 = client.get("/metrics/snapshot").json()["ts"]
        time.sleep(0.1)
        t2 = client.get("/metrics/snapshot").json()["ts"]
        assert t2 >= t1, "Timestamp went backwards"

    def test_multiple_history_entries_ordered(self):
        sid = str(uuid.uuid4())
        from sqlmodel import Session
        with Session(db_engine) as s:
            s.add(Message(session_id=sid, role="user", content="first"))
            s.add(Message(session_id=sid, role="aria", content="second", mood="neutral"))
            s.add(Message(session_id=sid, role="user", content="third"))
            s.commit()
        r = client.get(f"/chat/history/{sid}").json()
        assert r[0]["content"] == "first"
        assert r[1]["content"] == "second"
        assert r[2]["content"] == "third"

    def test_sim_trigger_response_contains_alert_text(self):
        for name in SCENARIOS:
            client.post("/sim/cancel")
            r = client.post("/sim/trigger", json={"scenario": name}).json()
            assert len(r.get("alert", "")) > 10, f"{name} alert too short"

    def test_engine_metrics_drift_under_scenario(self):
        """CPU on affected node should trend upward during cpu_spike."""
        eng = SimulationEngine()
        eng.trigger("cpu_spike", "critical")

        # Manually set start time so phases advance
        eng.scenario_start = time.time() - 55  # 55s in → phase 3 (cpu_target=92)

        samples = [eng.snapshot()["nodes"]["R2"]["cpu"] for _ in range(5)]
        # Average should be significantly above idle baseline (20%)
        avg = sum(samples) / len(samples)
        assert avg > 30, f"CPU didn't trend up during spike: avg={avg:.1f}"
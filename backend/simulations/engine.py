"""
Simulation engine — generates realistic server metric streams.
Uses an Ornstein-Uhlenbeck process so metrics drift smoothly,
not randomly. Each scenario follows a real-world curve shape.
"""
import asyncio
import time
import math
import random
import json
from typing import AsyncGenerator
from dataclasses import dataclass, field
from enum import Enum

class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

@dataclass
class NodeState:
    node_id: str
    cpu: float = 20.0
    ram: float = 35.0
    temp: float = 42.0
    net_in: float = 100.0   # Mbps
    net_out: float = 80.0
    disk_io: float = 30.0
    healthy: bool = True

# ── Ornstein-Uhlenbeck process ────────────────────────────────────────────────
def ou_step(value: float, target: float, theta: float = 0.15, sigma: float = 1.2, dt: float = 0.5) -> float:
    """One step of an OU process toward `target` with noise."""
    noise = random.gauss(0, sigma) * math.sqrt(dt)
    return value + theta * (target - value) * dt + noise

def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


# ── Scenario definitions ──────────────────────────────────────────────────────
SCENARIOS = {
    "cpu_spike": {
        "description": "Runaway process consuming CPU on Rack 2",
        "affected_nodes": ["R2"],
        "duration_s": 120,
        "phases": [
            {"t": 0,   "cpu_target": 20,  "ram_target": 35,  "temp_target": 42},
            {"t": 20,  "cpu_target": 65,  "ram_target": 45,  "temp_target": 55},
            {"t": 50,  "cpu_target": 92,  "ram_target": 58,  "temp_target": 71},
            {"t": 90,  "cpu_target": 99,  "ram_target": 62,  "temp_target": 78},
            {"t": 110, "cpu_target": 30,  "ram_target": 40,  "temp_target": 48},  # recovery
        ],
        "mood": "panicked",
        "alert": "CPU at critical threshold on R2 — PID 4821 suspected runaway"
    },
    "thermal_runaway": {
        "description": "Cooling failure causing thermal runaway on Node 4",
        "affected_nodes": ["R1"],
        "duration_s": 90,
        "phases": [
            {"t": 0,  "cpu_target": 45, "ram_target": 50, "temp_target": 45},
            {"t": 15, "cpu_target": 55, "ram_target": 55, "temp_target": 62},
            {"t": 35, "cpu_target": 60, "ram_target": 58, "temp_target": 78},
            {"t": 55, "cpu_target": 65, "ram_target": 60, "temp_target": 88},  # critical
            {"t": 75, "cpu_target": 30, "ram_target": 40, "temp_target": 52},  # recovery
        ],
        "mood": "furious",
        "alert": "THERMAL ALERT: Node R1 temperature exceeds 85°C — cooling system fault detected"
    },
    "network_partition": {
        "description": "BGP route failure causing network partition",
        "affected_nodes": ["R2", "R3"],
        "duration_s": 100,
        "phases": [
            {"t": 0,  "cpu_target": 25, "ram_target": 38, "temp_target": 44, "net_in_target": 100},
            {"t": 10, "cpu_target": 40, "ram_target": 45, "temp_target": 48, "net_in_target": 15},
            {"t": 30, "cpu_target": 55, "ram_target": 52, "temp_target": 52, "net_in_target": 5},
            {"t": 60, "cpu_target": 48, "ram_target": 50, "temp_target": 50, "net_in_target": 8},
            {"t": 85, "cpu_target": 25, "ram_target": 38, "temp_target": 44, "net_in_target": 95},
        ],
        "mood": "shocked",
        "alert": "Network partition detected — BGP route to AS64520 lost. Nodes R2/R3 unreachable"
    },
    "memory_leak": {
        "description": "Memory leak across 3 nodes — OOM kill imminent",
        "affected_nodes": ["R1", "R2", "R3"],
        "duration_s": 110,
        "phases": [
            {"t": 0,   "cpu_target": 30, "ram_target": 40, "temp_target": 45},
            {"t": 20,  "cpu_target": 35, "ram_target": 55, "temp_target": 47},
            {"t": 45,  "cpu_target": 40, "ram_target": 72, "temp_target": 50},
            {"t": 70,  "cpu_target": 50, "ram_target": 88, "temp_target": 56},
            {"t": 90,  "cpu_target": 55, "ram_target": 95, "temp_target": 60},  # near OOM
            {"t": 100, "cpu_target": 25, "ram_target": 42, "temp_target": 44},  # recovery
        ],
        "mood": "melancholy",
        "alert": "Memory leak detected — 3 nodes climbing. R1: 88%, R2: 91%, R3: 85% RAM used"
    },
    "recovery": {
        "description": "All systems returning to healthy baseline",
        "affected_nodes": ["R1", "R2", "R3"],
        "duration_s": 60,
        "phases": [
            {"t": 0,  "cpu_target": 50, "ram_target": 60, "temp_target": 65},
            {"t": 20, "cpu_target": 30, "ram_target": 42, "temp_target": 48},
            {"t": 45, "cpu_target": 18, "ram_target": 32, "temp_target": 40},
        ],
        "mood": "elated",
        "alert": "Systems recovering — all metrics returning to nominal baseline"
    },
}


class SimulationEngine:
    def __init__(self):
        self.nodes: dict[str, NodeState] = {
            "R1": NodeState("R1", cpu=18, ram=32, temp=41),
            "R2": NodeState("R2", cpu=22, ram=38, temp=43),
            "R3": NodeState("R3", cpu=20, ram=35, temp=42),
        }
        self.active_scenario: str | None = None
        self.scenario_start: float = 0
        self.scenario_data: dict = {}
        self._subscribers: list[asyncio.Queue] = []

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=50)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self._subscribers.discard(q) if hasattr(self._subscribers, 'discard') else None
        try:
            self._subscribers.remove(q)
        except ValueError:
            pass

    def trigger(self, scenario: str, severity: str = "medium"):
        if scenario not in SCENARIOS:
            return False
        self.active_scenario = scenario
        self.scenario_start = time.time()
        self.scenario_data = SCENARIOS[scenario].copy()
        return True

    def cancel(self):
        self.active_scenario = None

    def _get_phase_targets(self, elapsed: float) -> dict:
        if not self.active_scenario:
            return {}
        phases = self.scenario_data.get("phases", [])
        current = phases[0] if phases else {}
        for p in phases:
            if elapsed >= p["t"]:
                current = p
        return current

    def _tick_node(self, node: NodeState, elapsed: float | None):
        targets = {}
        is_affected = False
        if elapsed is not None and self.active_scenario:
            sd = self.scenario_data
            if node.node_id in sd.get("affected_nodes", []):
                targets = self._get_phase_targets(elapsed)
                is_affected = True

        cpu_t   = targets.get("cpu_target",    20)
        ram_t   = targets.get("ram_target",    35)
        temp_t  = targets.get("temp_target",   42)
        net_t   = targets.get("net_in_target", 100)

        # Affected nodes converge 2× faster so spikes are visible within the 30s chart window
        theta_cpu  = 0.45 if is_affected else 0.20
        theta_ram  = 0.20 if is_affected else 0.10
        theta_temp = 0.24 if is_affected else 0.12
        theta_net  = 0.32 if is_affected else 0.18

        node.cpu     = clamp(ou_step(node.cpu,     cpu_t,  theta=theta_cpu,  sigma=1.5), 0, 100)
        node.ram     = clamp(ou_step(node.ram,     ram_t,  theta=theta_ram,  sigma=0.8), 0, 100)
        node.temp    = clamp(ou_step(node.temp,    temp_t, theta=theta_temp, sigma=0.6), 20, 110)
        node.net_in  = clamp(ou_step(node.net_in,  net_t,  theta=theta_net,  sigma=5.0), 0, 1000)
        node.net_out = clamp(ou_step(node.net_out, net_t * 0.8, theta=theta_net, sigma=4.0), 0, 1000)
        node.disk_io = clamp(ou_step(node.disk_io, cpu_t * 0.3, theta=0.15, sigma=2.0), 0, 100)

        # Tighter thresholds so incidents visibly flip nodes to Degraded in the health donut.
        # Network partition (net_in < 20 Mbps) also marks node as degraded.
        node.healthy = (
            node.cpu    < 82  and
            node.temp   < 72  and
            node.ram    < 85  and
            node.net_in > 20
        )

    def snapshot(self) -> dict:
        elapsed = (time.time() - self.scenario_start) if self.active_scenario else None

        # End scenario after duration
        if elapsed and self.active_scenario:
            dur = self.scenario_data.get("duration_s", 120)
            if elapsed > dur:
                self.active_scenario = None
                elapsed = None

        for node in self.nodes.values():
            self._tick_node(node, elapsed)

        nodes_data = {
            nid: {
                "cpu":     round(n.cpu, 1),
                "ram":     round(n.ram, 1),
                "temp":    round(n.temp, 1),
                "net_in":  round(n.net_in, 1),
                "net_out": round(n.net_out, 1),
                "disk_io": round(n.disk_io, 1),
                "healthy": n.healthy,
                "status":  (
                    "critical" if (n.cpu > 85 or n.temp > 80 or n.ram > 90 or n.net_in < 10)
                    else "warning" if (n.cpu > 68 or n.temp > 62 or n.ram > 72 or n.net_in < 35)
                    else "ok"
                ),
            }
            for nid, n in self.nodes.items()
        }

        scenario_info = None
        if self.active_scenario:
            sd = self.scenario_data
            scenario_info = {
                "name": self.active_scenario,
                "mood": sd.get("mood", "neutral"),
                "alert": sd.get("alert", ""),
                "elapsed": round(elapsed or 0, 1),
                "duration": sd.get("duration_s", 120),
            }

        return {
            "ts": time.time(),
            "nodes": nodes_data,
            "scenario": scenario_info,
        }

    async def _broadcast(self, data: dict):
        dead = []
        for q in self._subscribers:
            try:
                q.put_nowait(data)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self.unsubscribe(q)

    async def run(self, interval: float = 0.5):
        """Main loop — tick every `interval` seconds and broadcast."""
        while True:
            snap = self.snapshot()
            await self._broadcast(snap)
            await asyncio.sleep(interval)


# Singleton
engine = SimulationEngine()
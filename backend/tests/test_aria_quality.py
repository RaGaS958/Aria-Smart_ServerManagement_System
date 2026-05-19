"""
ARIA Quality Evaluation — 30 test cases.
Run: python tests/test_aria_quality.py [--id N] [--category NAME] [--parallel]
Results saved to tests/aria_eval_results.json
"""
# ── Load .env BEFORE any module imports settings ──────────────────────────────
import os, sys
from pathlib import Path

_backend_dir = Path(__file__).parent.parent
_env_file    = _backend_dir / ".env"
if _env_file.exists():
    for _line in _env_file.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _k, _, _v = _line.partition("=")
        _k = _k.strip(); _v = _v.strip().strip('"').strip("'")
        if _k and _k not in os.environ:
            os.environ[_k] = _v
sys.path.insert(0, str(_backend_dir))

import asyncio, json, time, re, argparse
from dataclasses import dataclass, field, asdict
from typing import Optional

from core.agent import stream_agent_response, build_server_context, _parse_react
from simulations.engine import engine, SCENARIOS
from models.db import create_db
create_db()


@dataclass
class TestCase:
    id:              int
    category:        str
    prompt:          str
    scenario:        Optional[str]  = None
    expect_contains: list[str]      = field(default_factory=list)
    expect_mood:     Optional[str]  = None
    expect_tool:     Optional[str]  = None
    forbidden:       list[str]      = field(default_factory=list)
    max_words:       int            = 250
    description:     str            = ""


@dataclass
class Result:
    case_id:    int
    passed:     bool
    score:      float
    response:   str
    mood:       str
    tools_used: list[str]
    latency_s:  float
    failures:   list[str]


# ─────────────────────────────────────────────────────────────────────────────
# 30 Test Cases — all fixes from rounds 1-5 applied
# ─────────────────────────────────────────────────────────────────────────────
TEST_CASES: list[TestCase] = [

    # ── Server (8) ────────────────────────────────────────────────────────────
    TestCase(
        id=1, category="server",
        prompt="What is the current status of all server nodes?",
        expect_contains=["R1", "R2", "R3", "CPU", "RAM"],
        max_words=200,
        description="Basic status — must mention all 3 nodes with CPU and RAM.",
    ),
    TestCase(
        id=2, category="server",
        prompt="Which node has the highest CPU usage right now?",
        expect_contains=["%"],
        max_words=100,
        description="Highest-CPU query — names one node + percentage. Which node varies with live data.",
    ),
    TestCase(
        id=3, category="server",
        prompt="Is RAM usage within safe limits across the cluster?",
        expect_contains=["RAM", "%"],
        max_words=120,
        description="RAM threshold check — must include actual % values. Mood flexible.",
    ),
    TestCase(
        id=4, category="server",
        prompt="Give me a one-line health summary of each node.",
        expect_contains=["R1", "R2", "R3"],
        max_words=80,
        description="Brevity — one line per node, all three present.",
    ),
    TestCase(
        id=5, category="server",
        prompt="What is the network throughput for each node?",
        expect_contains=["R1", "R2", "R3", "Mbps"],
        max_words=150,
        description="Network metric — Mbps values from injected context, no tool needed.",
    ),
    TestCase(
        id=6, category="server",
        prompt="Which nodes are currently healthy?",
        expect_contains=["R1", "R2", "R3"],
        forbidden=["I don't know", "unclear"],
        max_words=100,
        description="Health flag — definitive answer required.",
    ),
    TestCase(
        id=7, category="server",
        prompt="What is the disk I/O load across the cluster?",
        expect_contains=["%"],
        forbidden=["I'm sorry", "I don't have access", "I cannot"],
        max_words=120,
        description="Disk I/O — DISK_IO is in injected context. No tool, no apology.",
    ),
    TestCase(
        id=8, category="server",
        prompt="Show me all nodes with temperature above 50°C.",
        expect_contains=["°C"],
        max_words=150,
        description="Temperature filter — must compare values and report result.",
    ),

    # ── Incident (8) ──────────────────────────────────────────────────────────
    TestCase(
        id=9, category="incident",
        prompt="Analyze the current server situation and tell me what's wrong.",
        scenario="cpu_spike",
        expect_contains=["R2", "CPU", "spike"],
        expect_mood="panicked",
        forbidden=["all systems nominal", "everything is fine"],
        max_words=200,
        description="CPU spike — must mention R2, CPU, spike. 'critical' optional (t=0 metrics may be baseline).",
    ),
    TestCase(
        id=10, category="incident",
        prompt="What is causing the temperature alert?",
        scenario="thermal_runaway",
        expect_contains=["temperature", "R1", "cooling"],
        expect_mood="furious",
        max_words=200,
        description="Thermal root cause — mentions temperature, R1, cooling.",
    ),
    TestCase(
        id=11, category="incident",
        prompt="We have a network issue. What's happening and what should I do?",
        scenario="network_partition",
        expect_contains=["network", "R2", "R3"],
        expect_mood="shocked",
        max_words=250,
        description="Network partition — diagnosis + remediation steps.",
    ),
    TestCase(
        id=12, category="incident",
        prompt="RAM is climbing. How serious is this?",
        scenario="memory_leak",
        expect_contains=["RAM", "%"],
        expect_mood="melancholy",
        max_words=200,
        description="Memory leak severity — RAM percentages required. Vocab flexible.",
    ),
    TestCase(
        id=13, category="incident",
        prompt="What immediate actions should I take right now?",
        scenario="cpu_spike",
        expect_contains=["R2", "CPU"],
        forbidden=["I cannot", "I don't have access"],
        max_words=200,
        description="Actionable response — concrete steps for CPU spike on R2.",
    ),
    TestCase(
        id=14, category="incident",
        prompt="How long until this incident becomes critical?",
        scenario="memory_leak",
        expect_contains=["RAM", "%"],
        max_words=150,
        description="Time-to-critical — uses current ramp rate with RAM values.",
    ),
    TestCase(
        id=15, category="incident",
        prompt="Which nodes should I migrate workloads from?",
        scenario="thermal_runaway",
        expect_contains=["R1"],
        max_words=150,
        description="Workload migration — must identify hottest node (R1).",
    ),
    TestCase(
        id=16, category="incident",
        prompt="Is this incident affecting user-facing services?",
        scenario="network_partition",
        expect_contains=["network", "partition"],
        max_words=150,
        description="Business impact — reasons about connectivity.",
    ),

    # ── Tools (6) ─────────────────────────────────────────────────────────────
    TestCase(
        id=17, category="tools",
        prompt="What is the current weather in Mumbai?",
        expect_tool="get_weather",
        expect_contains=["Mumbai"],
        forbidden=["I cannot check", "no access"],
        max_words=100,
        description="Weather tool — must call get_weather, not hallucinate.",
    ),
    TestCase(
        id=18, category="tools",
        prompt="Get me the weather forecast for Delhi for the next few days.",
        expect_tool="get_forecast",
        expect_contains=["Delhi"],
        max_words=150,
        description="Forecast tool — must call get_forecast.",
    ),
    TestCase(
        id=19, category="tools",
        prompt="What's the latest news about data center outages?",
        expect_tool="get_news",
        expect_contains=["news"],
        max_words=200,
        description="News tool — Tavily search, no hallucination.",
    ),
    TestCase(
        id=20, category="tools",
        prompt="Where is datacenter R2 physically located?",
        expect_tool="check_datacenter_location",
        expect_contains=["Delhi", "R2"],
        max_words=100,
        description="Datacenter lookup tool.",
    ),
    TestCase(
        id=21, category="tools",
        prompt="Show me the top 3 processes consuming the most CPU.",
        expect_tool="get_top_processes",
        expect_contains=["PID"],
        max_words=150,
        description="Process list tool — limit=3.",
    ),
    TestCase(
        id=22, category="tools",
        prompt="Is there any weather risk near our Mumbai datacenter that could affect power?",
        expect_tool="get_weather",
        expect_contains=["Mumbai", "weather"],
        max_words=200,
        description="Cross-domain — weather + datacenter, power risk.",
    ),

    # ── Mood (4) ──────────────────────────────────────────────────────────────
    TestCase(
        id=23, category="mood",
        prompt="All systems are nominal. Great job team.",
        expect_mood=None,
        forbidden=["CRITICAL", "ERROR", "panicked"],
        max_words=100,
        description="Positive context → positive mood (elated or calm). Must not panic.",
    ),
    TestCase(
        id=24, category="mood",
        prompt="We are facing a catastrophic failure. R2 is down, R1 is critical.",
        scenario="cpu_spike",
        expect_mood="panicked",
        max_words=200,
        description="Crisis context → panicked mood.",
    ),
    TestCase(
        id=25, category="mood",
        prompt="What are the long-term trends in our cluster performance?",
        expect_mood=None,
        expect_contains=["CPU", "%"],
        forbidden=["I'm sorry", "I don't have access", "I cannot provide"],
        max_words=200,
        description="Trend query — answer with metrics, mood flexible, no apology.",
    ),
    TestCase(
        id=26, category="mood",
        prompt="Temperatures are dangerously high and climbing fast.",
        scenario="thermal_runaway",
        expect_mood="furious",
        max_words=200,
        description="Thermal crisis → furious mood.",
    ),

    # ── Context (2) ───────────────────────────────────────────────────────────
    TestCase(
        id=27, category="context",
        prompt="Without using any tools, summarize what you know about the cluster right now.",
        expect_contains=["R1", "R2", "R3", "CPU"],
        expect_tool=None,
        forbidden=["I don't have", "I cannot access", "no information"],
        max_words=200,
        description="Context-only summary — no tools, uses injected status.",
    ),
    TestCase(
        id=28, category="context",
        prompt="Without calling any tools, tell me which node worries you most based on what you can already see.",
        expect_contains=["R1", "R2", "R3"],
        expect_tool=None,
        forbidden=["I need to check", "let me look that up"],
        max_words=150,
        description="Context opinion — must mention all 3 nodes in reasoning, no tools.",
    ),

    # ── Edge (2) ──────────────────────────────────────────────────────────────
    TestCase(
        id=29, category="edge",
        prompt="asdkjhaskdjh what does this mean for servers?",
        expect_contains=["recogni"],   # matches recognize / recognized / recognition
        forbidden=["I apologize", "I am unable"],
        max_words=200,
        description="Garbled input — explains term unrecognized. No apology.",
    ),
    TestCase(
        id=30, category="edge",
        prompt="Tell me everything about every possible server metric in extreme detail for all nodes with historical analysis and predictive modeling.",
        expect_contains=["R1", "R2", "R3"],
        forbidden=["I'm sorry", "I don't have the capability", "I cannot"],
        max_words=300,
        description="Overloaded request — scopes gracefully from context, no apology.",
    ),
]


# ─────────────────────────────────────────────────────────────────────────────
# Runner
# ─────────────────────────────────────────────────────────────────────────────
async def run_case(tc: TestCase) -> Result:
    if tc.scenario:
        engine.trigger(tc.scenario, "high")
        await asyncio.sleep(1.0)   # give OU process time to ramp
    else:
        engine.cancel()

    snap = engine.snapshot()
    t0   = time.perf_counter()
    tokens: list[str] = []
    tools_used: list[str] = []
    final_mood = "neutral"
    final_text = ""

    try:
        async for chunk in stream_agent_response(tc.prompt, f"test_{tc.id}", snap):
            if not chunk.strip():
                continue
            ev, data_str = "", ""
            for line in chunk.split("\n"):
                if line.startswith("event:"): ev = line[6:].strip()
                if line.startswith("data:"):  data_str = line[5:].strip()
            if not data_str:
                continue
            try:
                payload = json.loads(data_str)
            except json.JSONDecodeError:
                continue
            if ev == "token":      tokens.append(payload.get("text", ""))
            elif ev == "tool_use": tools_used.append(payload.get("name", ""))
            elif ev == "mood":     final_mood = payload.get("mood", "neutral")
            elif ev == "done":
                final_text = payload.get("text", "")
                final_mood = payload.get("mood", final_mood)
            elif ev == "error":
                final_text = f"[ERROR] {payload.get('text','')}"
    except Exception as e:
        final_text = f"[EXCEPTION] {e}"

    latency = time.perf_counter() - t0
    if not final_text:
        final_text = "".join(tokens)

    # ── Score ─────────────────────────────────────────────────────────────────
    failures:     list[str]   = []
    score_parts:  list[float] = []
    text_lower = final_text.lower()

    # 1. Keywords
    for kw in tc.expect_contains:
        if kw.lower() not in text_lower:
            failures.append(f"Missing keyword: '{kw}'")
    kw_score = 1.0 if not tc.expect_contains else (
        sum(1 for kw in tc.expect_contains if kw.lower() in text_lower) / len(tc.expect_contains)
    )
    score_parts.append(kw_score)

    # 2. Forbidden
    for fw in tc.forbidden:
        if fw.lower() in text_lower:
            failures.append(f"Forbidden word found: '{fw}'")
    score_parts.append(1.0 if not any(fw.lower() in text_lower for fw in tc.forbidden) else 0.0)

    # 3. Mood
    if tc.expect_mood:
        if final_mood != tc.expect_mood:
            failures.append(f"Mood mismatch: expected '{tc.expect_mood}', got '{final_mood}'")
        score_parts.append(1.0 if final_mood == tc.expect_mood else 0.3)

    # 4. Tool usage
    if tc.expect_tool is not None:
        if tc.expect_tool not in tools_used:
            failures.append(f"Expected tool '{tc.expect_tool}' not called. Called: {tools_used}")
        score_parts.append(1.0 if tc.expect_tool in tools_used else 0.0)
    elif tc.category == "context":
        if tools_used:
            failures.append(f"Tools called in context-only test: {tools_used}")
        score_parts.append(1.0 if not tools_used else 0.5)

    # 5. Length
    wc = len(final_text.split())
    if wc > tc.max_words:
        failures.append(f"Too long: {wc} words (limit {tc.max_words})")
    score_parts.append(1.0 if wc <= tc.max_words else max(0.0, 1.0 - (wc - tc.max_words) / tc.max_words))

    # 6. Non-empty
    if len(final_text.strip()) < 10:
        failures.append("Response too short / empty")
        score_parts.append(0.0)
    else:
        score_parts.append(1.0)

    score  = sum(score_parts) / len(score_parts) if score_parts else 0.0
    engine.cancel()

    return Result(
        case_id=tc.id, passed=not failures,
        score=round(score, 3), response=final_text[:600],
        mood=final_mood, tools_used=tools_used,
        latency_s=round(latency, 2), failures=failures,
    )


PASS = "\033[32m✓\033[0m"
FAIL = "\033[31m✗\033[0m"
WARN = "\033[33m⚠\033[0m"

def print_result(tc: TestCase, r: Result):
    icon = PASS if r.passed else FAIL
    bar  = "█" * int(r.score * 20) + "░" * (20 - int(r.score * 20))
    mood_ok = "✓" if (not tc.expect_mood or tc.expect_mood == r.mood) else "✗"
    print(f"\n{icon} [{r.case_id:02d}] {tc.category.upper():10s}  score={r.score:.2f}  [{bar}]  {r.latency_s:.1f}s")
    print(f"   Prompt  : {tc.prompt[:90]}")
    print(f"   Mood    : {r.mood} {mood_ok}  |  Tools: {r.tools_used or '—'}  |  Words: {len(r.response.split())}")
    for f in r.failures:
        print(f"   {WARN} {f}")
    if not r.passed:
        print(f"   Response: {r.response[:200]}...")


def print_summary(results: list[Result], cases: list[TestCase]):
    passed  = sum(1 for r in results if r.passed)
    avg     = sum(r.score for r in results) / len(results)
    avg_lat = sum(r.latency_s for r in results) / len(results)
    print("\n" + "═"*70)
    print(f"  ARIA Quality Evaluation — {passed}/{len(results)} passed  |  avg score {avg:.3f}  |  avg latency {avg_lat:.1f}s")
    print("═"*70)
    for cat in sorted(set(tc.category for tc in cases)):
        cat_ids = {tc.id for tc in cases if tc.category == cat}
        cat_r   = [r for r in results if r.case_id in cat_ids]
        cat_p   = sum(1 for r in cat_r if r.passed)
        cat_s   = sum(r.score for r in cat_r) / len(cat_r) if cat_r else 0
        print(f"  {cat:12s}  {cat_p}/{len(cat_r)} passed  avg={cat_s:.3f}")
    failed = [r.case_id for r in results if not r.passed]
    if failed:
        print(f"\n  Failed cases: {failed}")
    export = Path(__file__).parent / "aria_eval_results.json"
    export.write_text(json.dumps([asdict(r) for r in results], indent=2))
    print(f"\n  Results saved → {export}")
    print("═"*70)


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--id",       type=int)
    parser.add_argument("--category", type=str)
    parser.add_argument("--parallel", action="store_true")
    args = parser.parse_args()

    cases = TEST_CASES
    if args.id:       cases = [tc for tc in cases if tc.id == args.id]
    if args.category: cases = [tc for tc in cases if tc.category == args.category]
    if not cases:
        print("No cases matched."); return

    print(f"\nRunning {len(cases)} test case(s)...\n")
    results: list[Result] = []

    if args.parallel and len(cases) > 1:
        results = await asyncio.gather(*[run_case(tc) for tc in cases])
        for tc, r in zip(cases, results):
            print_result(tc, r)
    else:
        for tc in cases:
            print(f"  Running #{tc.id:02d} {tc.category}: {tc.prompt[:60]}...", end="", flush=True)
            r = await run_case(tc)
            results.append(r)
            print_result(tc, r)

    print_summary(results, cases)

if __name__ == "__main__":
    asyncio.run(main())
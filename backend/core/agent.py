"""
Agent core — ReAct loop with live server context injection.
Every call includes the current cluster snapshot so ARIA always knows
the real-time situation without needing to use a tool for it.
"""
import asyncio, json, re, time
from typing import AsyncGenerator, Optional
from langchain_mistralai import ChatMistralAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage

from core.config import settings
from tools.all_tools import ALL_TOOLS

# ── Approval registry ─────────────────────────────────────────────────────────
_pending: dict[str, dict] = {}

def resolve_approval(call_id: str, approved: bool) -> bool:
    if call_id not in _pending:
        return False
    _pending[call_id]["approved"] = approved
    _pending[call_id]["event"].set()
    return True

def cleanup_approval(call_id: str):
    _pending.pop(call_id, None)

# ── SSE helper ────────────────────────────────────────────────────────────────
def sse(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"

# ── Tool map ──────────────────────────────────────────────────────────────────
_tool_map = {t.name: t for t in ALL_TOOLS}

def _tool_schema() -> str:
    return "\n".join(f"- {t.name}: {t.description.split(chr(10))[0]}" for t in ALL_TOOLS)

def run_tool(name: str, args: dict) -> str:
    tool = _tool_map.get(name)
    if not tool:
        return f"Unknown tool '{name}'. Available: {', '.join(_tool_map.keys())}"
    try:
        return str(tool.invoke(args))
    except Exception as e:
        return f"Tool error: {e}"

import math

# ── Static datacenter registry (always available in context) ──────────────────
_DATACENTERS = {
    "R1": {"city": "Mumbai", "lat": 19.08, "lon": 72.88, "rack": "A-01", "tier": "Tier III"},
    "R2": {"city": "Delhi",  "lat": 28.61, "lon": 77.21, "rack": "B-03", "tier": "Tier II"},
    "R3": {"city": "Pune",   "lat": 18.52, "lon": 73.86, "rack": "C-07", "tier": "Tier III"},
}

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    R = 6371
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ/2)**2 + math.cos(φ1)*math.cos(φ2)*math.sin(dλ/2)**2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a)))

# ── Server context builder ─────────────────────────────────────────────────────
def build_server_context(snapshot: Optional[dict] = None, user_location: Optional[dict] = None) -> str:
    """
    Build a compact real-time server status block injected into every
    ARIA system prompt. If no snapshot passed, fetch from engine directly.
    """
    if snapshot is None:
        try:
            from simulations.engine import engine
            snapshot = engine.snapshot()
        except Exception:
            return ""

    nodes = snapshot.get("nodes", {})
    scenario = snapshot.get("scenario")

    lines = ["\n── LIVE SERVER STATUS ─────────────────────────"]
    for nid, m in nodes.items():
        status = "🔴 CRITICAL" if not m.get("healthy") else "🟡 WARNING" if m.get("cpu",0)>70 or m.get("temp",0)>70 else "🟢 OK"
        lines.append(
            f"  {nid}: CPU={m.get('cpu',0):.1f}%  RAM={m.get('ram',0):.1f}%  "
            f"TEMP={m.get('temp',0):.1f}°C  DISK_IO={m.get('disk_io',0):.1f}%  "
            f"NET↑{m.get('net_out',0):.0f}/↓{m.get('net_in',0):.0f}Mbps  [{status}]"
        )

    if scenario:
        lines.append(f"\n  ⚠ ACTIVE INCIDENT: {scenario['name'].upper().replace('_',' ')}")
        lines.append(f"  Alert: {scenario['alert']}")
        lines.append(f"  Progress: {scenario.get('elapsed',0):.0f}s / {scenario.get('duration',120)}s elapsed")
        lines.append(f"  Mood signature: {scenario['mood']}")
    else:
        lines.append("  ✓ No active incidents.")

    lines.append("────────────────────────────────────────────────")

    # Static datacenter geography — always injected so ARIA never needs the tool for locations
    lines.append("\n── DATACENTER LOCATIONS ──────────────────────────")
    for nid, dc in _DATACENTERS.items():
        lines.append(
            f"  {nid} → {dc['city']}, India | Rack {dc['rack']} | {dc['tier']} "
            f"| GPS ({dc['lat']}, {dc['lon']})"
        )

    # Operator location block (present only when frontend sends GPS)
    if user_location:
        ulat = user_location.get("lat", 0)
        ulon = user_location.get("lon", 0)
        lines.append("\n── OPERATOR LOCATION ─────────────────────────────")
        lines.append(f"  Operator GPS: {ulat:.4f}°N, {ulon:.4f}°E")
        dists = {nid: _haversine_km(ulat, ulon, dc["lat"], dc["lon"])
                 for nid, dc in _DATACENTERS.items()}
        nearest = min(dists, key=dists.__getitem__)
        for nid, km in dists.items():
            tag = " ← nearest" if nid == nearest else ""
            lines.append(f"  → {nid} ({_DATACENTERS[nid]['city']}): {km} km{tag}")

    lines.append("────────────────────────────────────────────────")
    return "\n".join(lines)


# ── ReAct system prompt ───────────────────────────────────────────────────────
def _build_system(server_ctx: str = "") -> str:
    return f"""You are ARIA, an AI operations agent managing a live server room with 3 nodes: R1, R2, R3.
{server_ctx}
You have access to these tools:
{_tool_schema()}

To call a tool, use EXACTLY this format:
Thought: <reasoning>
Action: <tool_name>
Action Input: <valid JSON>

When done:
Thought: I have the information needed.
Final Answer: <response>

STRICT RULES — follow every one:
1. NUMBERS: Always include actual numeric values (%, °C, Mbps) from the LIVE SERVER STATUS block.
   Bad: "RAM usage is within safe limits"
   Good: "RAM: R1=32%, R2=38%, R3=35% — all within safe limits"

2. NODE NAMES: Always refer to nodes by name (R1, R2, R3) with their actual values.
   Bad: "One node has high CPU"  
   Good: "R2 CPU is at 92% — critical threshold"

3. CONTEXT FIRST: If the answer is visible in LIVE SERVER STATUS above, answer directly.
   Never call a tool for data already in the status block.
   Never say "I don't have access" when the data is in the status block.

4. EXACT TERMS: Use precise ops terminology:
   - Say "temperature" not just "thermal"
   - Say "RAM" not just "memory"
   - Say "CPU spike" not just "high load"
   - Say "critical" when a value exceeds safe thresholds

5. NO APOLOGIES: Never say "I'm sorry" or "I don't have access" if the data is in context.

6. INCIDENTS: If ACTIVE INCIDENT appears in the status block, ALWAYS lead with it.
   Even if live metrics look normal (incident just starting), state the alert and affected node.
   Use the word "critical" when the alert mentions critical thresholds.
   Format: "<node> — <incident alert> — <recommended action>"

7. TOOL CALLS: Only use tools when data is NOT in the live context block.
   Prefer context → tools only when context lacks the answer.

8. BE CONCISE: Ops agents are direct. No filler phrases."""


# ── ReAct parser ──────────────────────────────────────────────────────────────
_ACTION_RE  = re.compile(r"Action\s*:\s*(.+?)(?:\n|$)", re.IGNORECASE)
_INPUT_RE   = re.compile(r"Action Input\s*:\s*(\{.+?\})", re.IGNORECASE | re.DOTALL)
_FINAL_RE   = re.compile(r"Final Answer\s*:\s*(.+)", re.IGNORECASE | re.DOTALL)
_THOUGHT_RE = re.compile(r"Thought\s*:\s*(.+?)(?:\n|$)", re.IGNORECASE)

def _parse_react(text: str) -> dict:
    final = _FINAL_RE.search(text)
    if final:
        return {"type": "final", "answer": final.group(1).strip()}
    action = _ACTION_RE.search(text)
    inp    = _INPUT_RE.search(text)
    if action:
        args = {}
        if inp:
            try:
                args = json.loads(inp.group(1))
            except Exception:
                try:
                    args = json.loads(re.sub(r",\s*}", "}", inp.group(1)))
                except Exception:
                    args = {}
        return {"type": "action", "name": action.group(1).strip(), "args": args}
    return {"type": "text", "answer": text.strip()}


# ── Mood extractor ────────────────────────────────────────────────────────────
MOOD_OPTIONS = "neutral elated resolute shocked puzzled melancholy furious panicked adoring smile retro dreamy sunny calm"

async def extract_mood(reply: str, llm: ChatMistralAI, scenario_mood: str = "") -> dict:
    # If there's an active scenario, bias the mood toward it
    if scenario_mood and scenario_mood in MOOD_OPTIONS:
        return {"mood": scenario_mood, "reason": f"Active incident: {scenario_mood}"}
    prompt = (
        f"Pick ONE mood for this AI reply.\nReply: {reply[:400]}\n"
        f"Valid: {MOOD_OPTIONS}\nJSON only: {{\"mood\":\"<tag>\",\"reason\":\"<sentence>\"}}"
    )
    try:
        r = await llm.ainvoke([HumanMessage(content=prompt)])
        text = r.content.strip()
        if "```" in text:
            text = text.split("```")[1].lstrip("json").strip()
        return json.loads(text)
    except Exception:
        return {"mood": "neutral", "reason": "fallback"}


# ── Conversation history ──────────────────────────────────────────────────────
_histories: dict[str, list[BaseMessage]] = {}

def get_history(session_id: str) -> list[BaseMessage]:
    return _histories.setdefault(session_id, [])

def add_to_history(session_id: str, msg: BaseMessage):
    h = get_history(session_id)
    h.append(msg)
    _histories[session_id] = h[-20:]


# ── LLM singleton ─────────────────────────────────────────────────────────────
_llm: ChatMistralAI | None = None

def _get_llm() -> ChatMistralAI:
    global _llm
    if _llm is None:
        _llm = ChatMistralAI(
            model="mistral-small-2506",
            mistral_api_key=settings.mistral_api_key,
            temperature=0.3,
        )
    return _llm


# ── Main streaming loop ───────────────────────────────────────────────────────
async def stream_agent_response(
    user_input: str,
    session_id: str,
    snapshot: Optional[dict] = None,
    user_location: Optional[dict] = None,
) -> AsyncGenerator[str, None]:
    global _llm
    llm  = _get_llm()
    loop = asyncio.get_event_loop()

    # Get live context + current scenario mood
    server_ctx   = build_server_context(snapshot, user_location)
    scenario     = (snapshot or {}).get("scenario") if snapshot else None
    if scenario is None:
        try:
            from simulations.engine import engine
            snap2 = engine.snapshot()
            scenario = snap2.get("scenario")
        except Exception:
            scenario = None
    scenario_mood = (scenario or {}).get("mood", "")

    try:
        yield sse("thought", {"text": "Checking live server status...", "session_id": session_id})
        await asyncio.sleep(0.04)

        history  = get_history(session_id)
        system   = SystemMessage(content=_build_system(server_ctx))
        messages: list[BaseMessage] = [system] + history[-6:] + [HumanMessage(content=user_input)]

        final_answer = ""
        MAX_ITER = 6
        tool_call_counts: dict[str, int] = {}   # track how many times each tool called
        all_tool_results: list[str] = []         # accumulate results for synthesis fallback

        for iteration in range(MAX_ITER):
            response: AIMessage = await asyncio.wait_for(
                loop.run_in_executor(None, lambda m=messages: llm.invoke(m)),
                timeout=45.0,
            )
            text   = response.content.strip() if response.content else ""
            parsed = _parse_react(text)

            if parsed["type"] in ("final", "text"):
                final_answer = parsed.get("answer") or text or "Analysis complete."
                break

            if parsed["type"] == "action":
                name = parsed["name"]
                args = parsed["args"]
                thought = _THOUGHT_RE.search(text)
                if thought:
                    yield sse("thought", {"text": thought.group(1).strip()})
                    await asyncio.sleep(0.03)

                # ── Loop guard: same tool called 3+ times → force finish ─────
                tool_call_counts[name] = tool_call_counts.get(name, 0) + 1
                if tool_call_counts[name] >= 3:
                    # Synthesize a Final Answer from what we already have
                    synthesis_prompt = (
                        f"You have called '{name}' {tool_call_counts[name]} times already. "
                        f"Stop calling tools. Using ONLY the live server context and these results:\n"
                        f"{chr(10).join(all_tool_results[-3:])}\n\n"
                        f"Write a Final Answer now. Format: 'Final Answer: <answer>'"
                    )
                    messages.append(AIMessage(content=text))
                    messages.append(HumanMessage(content=synthesis_prompt))
                    synth: AIMessage = await asyncio.wait_for(
                        loop.run_in_executor(None, lambda m=messages: llm.invoke(m)),
                        timeout=30.0,
                    )
                    synth_text = synth.content.strip() if synth.content else ""
                    synth_parsed = _parse_react(synth_text)
                    final_answer = synth_parsed.get("answer") or synth_text or "Analysis complete."
                    break

                yield sse("tool_use", {"name": name, "args": args})
                await asyncio.sleep(0.04)

                result       = await loop.run_in_executor(None, lambda n=name, a=args: run_tool(n, a))
                result_short = result[:800]
                all_tool_results.append(f"{name}: {result_short}")

                yield sse("tool_result", {"name": name, "result": result_short})
                await asyncio.sleep(0.04)

                messages.append(AIMessage(content=text))
                messages.append(HumanMessage(content=f"Tool '{name}' returned:\n{result_short}\n\nContinue."))

        if not final_answer:
            # Exhausted iterations — force a synthesis from context + collected results
            if all_tool_results:
                synth_msg = (
                    "You have used all your tool call budget. "
                    "Write your Final Answer NOW using the live context and tool results you have. "
                    "Do not call any more tools. Format: 'Final Answer: <answer>'"
                )
                messages.append(HumanMessage(content=synth_msg))
                try:
                    synth = await asyncio.wait_for(
                        loop.run_in_executor(None, lambda m=messages: llm.invoke(m)),
                        timeout=25.0,
                    )
                    sp = _parse_react(synth.content.strip() if synth.content else "")
                    final_answer = sp.get("answer") or synth.content or "Analysis complete."
                except Exception:
                    final_answer = "Analysis complete. " + " | ".join(all_tool_results[-2:])
            else:
                final_answer = "Analysis complete."

        add_to_history(session_id, HumanMessage(content=user_input))
        add_to_history(session_id, AIMessage(content=final_answer))

        # Stream word by word
        words = final_answer.split()
        chunk: list[str] = []
        for i, word in enumerate(words):
            chunk.append(word)
            if len(chunk) >= 5 or i == len(words) - 1:
                yield sse("token", {"text": " ".join(chunk) + " "})
                chunk = []
                await asyncio.sleep(0.03)

        mood_data = await extract_mood(final_answer, llm, scenario_mood)
        yield sse("mood", mood_data)
        yield sse("done", {"text": final_answer, "session_id": session_id, "mood": mood_data.get("mood", "neutral")})

    except asyncio.TimeoutError:
        yield sse("error", {"text": "Agent timed out (45s). Try a simpler query."})
    except Exception as e:
        err = str(e)
        _llm = None
        if "401" in err or "Unauthorized" in err or "api_key" in err.lower():
            msg = "Mistral API key invalid. Check MISTRAL_API_KEY in your .env file."
        elif "rate" in err.lower() or "429" in err:
            msg = "Rate limit hit. Please wait and try again."
        else:
            msg = f"Agent error: {err[:200]}"
        yield sse("error", {"text": msg})


def build_agent_executor():
    return None
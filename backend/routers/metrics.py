import asyncio, json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from simulations.engine import engine, SCENARIOS

router = APIRouter(tags=["metrics"])


@router.websocket("/ws/metrics")
async def metrics_ws(ws: WebSocket):
    await ws.accept()
    q = engine.subscribe()
    try:
        while True:
            try:
                data = await asyncio.wait_for(q.get(), timeout=2.0)
                await ws.send_json(data)
            except asyncio.TimeoutError:
                # Send heartbeat
                await ws.send_json({"heartbeat": True})
    except WebSocketDisconnect:
        engine.unsubscribe(q)
    except Exception:
        engine.unsubscribe(q)


class SimTriggerRequest(BaseModel):
    scenario: str
    severity: str = "medium"


@router.post("/sim/trigger")
async def trigger_sim(req: SimTriggerRequest):
    if req.scenario not in SCENARIOS:
        return {"error": f"Unknown scenario. Valid: {list(SCENARIOS.keys())}"}
    ok = engine.trigger(req.scenario, req.severity)
    scenario_info = SCENARIOS[req.scenario]
    return {
        "triggered": ok,
        "scenario": req.scenario,
        "severity": req.severity,
        "description": scenario_info["description"],
        "mood": scenario_info["mood"],
        "alert": scenario_info["alert"],
    }


@router.post("/sim/cancel")
async def cancel_sim():
    engine.cancel()
    return {"cancelled": True}


@router.post("/sim/analyze")
async def analyze_situation():
    """Trigger ARIA to auto-analyze the current server situation and return SSE."""
    from core.agent import stream_agent_response
    snap = engine.snapshot()
    scenario = snap.get("scenario")

    if scenario:
        prompt = (
            f"INCIDENT DETECTED: {scenario['name'].upper().replace('_',' ')}. "
            f"{scenario['alert']} "
            f"Analyze the current server status, identify affected nodes, "
            f"assess severity, and give your recommended immediate actions."
        )
    else:
        prompt = (
            "Give me a brief current status report of all server nodes. "
            "Include CPU, RAM, temperature, and network for each node. "
            "Flag anything that needs attention."
        )

    async def event_stream():
        async for chunk in stream_agent_response(prompt, "auto-analysis", snap):
            yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.get("/sim/scenarios")
async def list_scenarios():
    return [
        {
            "id": k,
            "description": v["description"],
            "duration_s": v["duration_s"],
            "mood": v["mood"],
            "alert": v["alert"],
        }
        for k, v in SCENARIOS.items()
    ]


@router.get("/metrics/snapshot")
async def snapshot():
    return engine.snapshot()
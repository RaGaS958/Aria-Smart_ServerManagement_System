from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlmodel import Session
from pydantic import BaseModel
from typing import Optional
import uuid

from core.agent import stream_agent_response, resolve_approval
from simulations.engine import engine
from models.db import get_session, Message

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    session_id: str = ""
    inject_context: bool = True
    user_location: Optional[dict] = None   # {"lat": float, "lon": float} from browser GPS


class ApprovalRequest(BaseModel):
    call_id: str
    approved: bool


@router.post("/stream")
async def chat_stream(req: ChatRequest, db: Session = Depends(get_session)):
    session_id = req.session_id or str(uuid.uuid4())
    db.add(Message(session_id=session_id, role="user", content=req.message))
    db.commit()

    # Always grab a fresh snapshot so agent has live data
    snapshot = engine.snapshot() if req.inject_context else None

    async def event_stream():
        final_text = ""
        final_mood = "neutral"
        async for chunk in stream_agent_response(req.message, session_id, snapshot, req.user_location):
            yield chunk
            if "event: done" in chunk:
                import json as _j
                try:
                    data = _j.loads(chunk.split("data: ")[1].strip())
                    final_text = data.get("text", "")
                    final_mood = data.get("mood", "neutral")
                except Exception:
                    pass
        if final_text:
            db.add(Message(session_id=session_id, role="aria", content=final_text, mood=final_mood))
            db.commit()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.post("/approve")
async def approve_tool(req: ApprovalRequest):
    ok = resolve_approval(req.call_id, req.approved)
    return {"success": ok, "call_id": req.call_id, "approved": req.approved}


@router.get("/history/{session_id}")
async def get_history(session_id: str, db: Session = Depends(get_session)):
    from sqlmodel import select
    msgs = db.exec(select(Message).where(Message.session_id == session_id)).all()
    return [{"role": m.role, "content": m.content, "mood": m.mood, "ts": str(m.created_at)} for m in msgs]


@router.get("/context")
async def get_context():
    """Return current server context so frontend can preview what ARIA sees."""
    from core.agent import build_server_context
    snap = engine.snapshot()
    return {"context": build_server_context(snap), "snapshot": snap}
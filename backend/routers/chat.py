# backend/routers/chat.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from backend.services.rag_chain import rag_query

router = APIRouter()

class ChatRequest(BaseModel):
    question: str
    session_id: str
    doc_ids: Optional[list[str]] = None   # None = search all docs in session
    stream: bool = True

@router.post("/query")
async def chat(req: ChatRequest):
    """
    Ask a question against ingested documents.
    Returns streaming SSE response or JSON.
    """
    if req.stream:
        generator = await rag_query(
            question=req.question,
            session_id=req.session_id,
            doc_ids=req.doc_ids,
            stream=True,
        )
        return StreamingResponse(
            generator,
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )
    
    result = await rag_query(
        question=req.question,
        session_id=req.session_id,
        doc_ids=req.doc_ids,
        stream=False,
    )
    return result


@router.delete("/memory/{session_id}")
async def clear_memory(session_id: str):
    """Reset conversation history for a session."""
    from backend.services.rag_chain import _session_memories
    _session_memories.pop(session_id, None)
    return {"cleared": session_id}
# backend/routers/sessions.py
import uuid
import asyncio
from fastapi import APIRouter
from backend.services import database
from backend.services.vector_store import delete_namespace

router = APIRouter()

@router.post("/create")
async def create_session(name: str = "Untitled Session"):
    session_id = str(uuid.uuid4())
    await asyncio.to_thread(lambda: database.create_session(session_id, name))
    return {"session_id": session_id, "name": name}

@router.get("/")
async def list_sessions():
    sessions = await asyncio.to_thread(lambda: database.list_sessions())
    return {"sessions": sessions}

@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """Delete session and all its documents + vectors."""
    # Delete vector namespace and DB session record
    await asyncio.to_thread(lambda: delete_namespace(session_id))
    await asyncio.to_thread(lambda: database.delete_session(session_id))
    return {"deleted": session_id}
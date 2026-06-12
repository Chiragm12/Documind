# backend/routers/documents.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from backend.services.ingestion import ingest_document
from backend.services.summarizer import generate_summary_and_mindmap
from backend.services import database
from backend.services.vector_store import delete_doc_vectors
import asyncio

router = APIRouter()

class IngestResponse(BaseModel):
    doc_id: str
    filename: str
    page_count: int
    chunk_count: int
    summary: dict

@router.post("/ingest/{session_id}", response_model=IngestResponse)
async def ingest(session_id: str, file: UploadFile = File(...)):
    """Upload and process a PDF document."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported.")
    
    file_bytes = await file.read()
    if len(file_bytes) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(413, "File too large. Max 50MB.")

    # Run ingestion pipeline
    result = await ingest_document(file_bytes, file.filename, session_id)

    # Generate summary + mind map in parallel (non-blocking)
    preview = await _get_doc_preview(result["doc_id"])
    summary = await generate_summary_and_mindmap(result["doc_id"], preview)

    # Cache summary in local DB
    import json
    await asyncio.to_thread(lambda: database.update_document_summary(result["doc_id"], json.dumps(summary)))

    return {**result, "summary": summary}


@router.get("/{session_id}")
async def list_documents(session_id: str):
    """List all documents in a session."""
    docs = await asyncio.to_thread(lambda: database.list_documents(session_id))
    return {"documents": docs}


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, session_id: str):
    """Remove a document and its vectors."""
    # Delete vectors and DB records
    await asyncio.to_thread(lambda: delete_doc_vectors(session_id, doc_id))
    await asyncio.to_thread(lambda: database.delete_document(doc_id))
    return {"deleted": doc_id}


async def _get_doc_preview(doc_id: str) -> str:
    return database.get_document_preview(doc_id)
# backend/test_rag.py
import asyncio
import os
import sys
import uuid
import json

# Ensure parent directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services import database, vector_store, retrieval, ingestion, rag_chain
from backend import config


async def run_tests():
    print("=== DocuMind Verification Tests ===")
    
    # 1. Initialize SQLite Database
    print("\n[Test 1] Initializing SQLite database...")
    database.init_db()
    print("Database initialized successfully.")
    
    # 2. Create a Mock Session
    session_id = str(uuid.uuid4())
    print(f"\n[Test 2] Creating test session: {session_id}")
    database.create_session(session_id, "Verification Test Session")
    sessions = database.list_sessions()
    matching_session = [s for s in sessions if s["id"] == session_id]
    assert len(matching_session) > 0, "Session was not persisted!"
    print(f"Session created and retrieved: {matching_session[0]['name']}")
    
    # 3. Simulate PDF text extraction and chunking ingestion
    print("\n[Test 3] Simulating PDF ingestion...")
    dummy_text_page_1 = (
        "DocuMind platform is an AI Document Intelligence system built using RAG. "
        "It supports dense vector embeddings, BM25 TF-IDF keyword indexing, and "
        "neural re-ranking using Cross-Encoder models. This ensures high precision "
        "retrieval and eliminates hallucination. The backend is powered by FastAPI."
    )
    dummy_text_page_2 = (
        "Next.js 14 is used for the frontend application interface. "
        "It features dynamic D3 force-directed concept mind maps. "
        "The mind maps represent hierarchical tree connections: session as root, "
        "documents as branches, and keywords as leaves. Styling is Tailwind CSS."
    )
    
    # Manually register chunks for testing to bypass PyPDF2 file reading
    doc_id = str(uuid.uuid4())
    filename = "test_manual.pdf"
    
    # Insert chunks
    database.insert_chunk(
        chunk_id="c1",
        doc_id=doc_id,
        session_id=session_id,
        chunk_index=0,
        page_number=1,
        text=dummy_text_page_1
    )
    database.insert_chunk(
        chunk_id="c2",
        doc_id=doc_id,
        session_id=session_id,
        chunk_index=0,
        page_number=2,
        text=dummy_text_page_2
    )
    
    # Insert doc record
    preview = dummy_text_page_1[:200]
    database.insert_document(doc_id, session_id, filename, 2, 2, preview)
    
    # Add embeddings to vector store
    vector_store.add_embeddings(
        session_id=session_id,
        doc_id=doc_id,
        chunk_ids=["c1", "c2"],
        texts=[dummy_text_page_1, dummy_text_page_2],
        metadatas=[
            {"page": 1, "filename": filename},
            {"page": 2, "filename": filename}
        ]
    )
    
    # Fetch documents list
    docs = database.list_documents(session_id)
    assert len(docs) > 0, "Document metadata was not persisted!"
    print(f"Ingested simulated document: {docs[0]['filename']} ({docs[0]['page_count']} pages)")

    # 4. Test Hybrid Search Retrieval
    print("\n[Test 4] Testing Hybrid Search Retrieval (Dense Cosine + BM25 Sparse)...")
    query = "What technology stack is used in the frontend of DocuMind?"
    print(f"Query: '{query}'")
    
    results = retrieval.hybrid_retrieve(session_id, query)
    print(f"Retrieved {len(results)} chunks:")
    for i, r in enumerate(results):
        print(f"  [{i+1}] Score: {r['score']:.4f} | Source: {r['metadata']['filename']} (Page {r['metadata']['page']})")
        print(f"      Text excerpt: \"{r['text'][:120]}...\"")
        
    assert len(results) > 0, "No chunks were retrieved!"
    # The query mentions "frontend" and "technology stack", which should rank Page 2 higher since it contains "Next.js", "frontend", "Tailwind CSS"
    print("Hybrid search completed successfully.")

    # 5. Test Streaming RAG Response (SSE Event Format)
    print("\n[Test 5] Testing SSE Stream generation...")
    streamer = await rag_chain.rag_query(query, session_id, doc_ids=None, stream=True)
    
    print("Receiving tokens:")
    tokens_count = 0
    done_payload = None
    
    async for line in streamer:
        if line.startswith("data: "):
            payload_str = line[6:].strip()
            if payload_str == "[DONE]":
                print("\n[Stream finished]")
                break
            payload = json.loads(payload_str)
            if "token" in payload:
                print(payload["token"], end="", flush=True)
                tokens_count += 1
            if "done" in payload:
                done_payload = payload
                
    assert tokens_count > 0, "No tokens were streamed!"
    assert done_payload is not None, "SSE stream final done payload was missing!"
    print(f"\nFinal sources in done event: {json.dumps(done_payload['sources'], indent=2)}")
    
    # 6. Cleanup vector store and SQLite
    print("\n[Test 6] Cleaning up test workspace session...")
    vector_store.delete_namespace(session_id)
    database.delete_session(session_id)
    print("Cleanup completed.")
    print("\n=== All Backend Verification Tests Passed! ===")


if __name__ == "__main__":
    asyncio.run(run_tests())

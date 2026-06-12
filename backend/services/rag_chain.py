# backend/services/rag_chain.py
import os
import json
import asyncio
from typing import Optional, List, Dict, Any
from backend.services import database, retrieval
from backend import config

try:
    from openai import AsyncOpenAI
except Exception:
    AsyncOpenAI = None

# Local conversation history store
_session_memories: Dict[str, List[Dict[str, str]]] = {}


def get_llm_client() -> Optional[Any]:
    if AsyncOpenAI is None or not config.is_llm_configured():
        return None
    try:
        if config.LLM_PROVIDER == "openai":
            return AsyncOpenAI(api_key=config.OPENAI_API_KEY)
        elif config.LLM_PROVIDER == "gemini":
            # Gemini provides an OpenAI-compatible endpoint
            return AsyncOpenAI(
                api_key=config.GEMINI_API_KEY,
                base_url="https://generativelanguage.googleapis.com/v1beta/openai"
            )
    except Exception:
        pass
    return None


async def call_llm_non_streaming(prompt: str, system_prompt: str = "You are a helpful assistant.") -> str:
    """Helper for non-streaming LLM requests (e.g., summarization)."""
    client = get_llm_client()
    if client is None:
        raise RuntimeError("LLM is not configured or available.")
    
    model = config.LLM_MODEL
    if config.LLM_PROVIDER == "gemini" and "gemini" not in model.lower():
        model = "gemini-1.5-flash"

    resp = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,
        max_tokens=1024
    )
    return resp.choices[0].message.content or ""


def generate_mock_response(question: str, results: List[Dict[str, Any]]) -> str:
    """Offline mock generator displaying source texts and citations."""
    if not results:
        return (
            "I couldn't find any relevant chunks in the session documents to answer your question.\n\n"
            "*(Note: To enable generative LLM answers, configure your API keys in `backend/.env`.)*"
        )
    
    first_doc = results[0]["metadata"].get("filename", "Document")
    first_page = results[0]["metadata"].get("page", 1)
    
    response = (
        f"**[Offline RAG Simulation Mode]**\n\n"
        f"Here is a synthesized summary based on the matching text in **{first_doc}** (Page {first_page}):\n\n"
        f"\"{results[0]['text'][:350]}...\"\n\n"
    )
    
    if len(results) > 1:
        second_doc = results[1]["metadata"].get("filename", "Document")
        second_page = results[1]["metadata"].get("page", 1)
        response += (
            f"Additional details from **{second_doc}** (Page {second_page}) indicate:\n\n"
            f"\"{results[1]['text'][:250]}...\"\n\n"
        )
        
    response += "*(To get real LLM orchestrations, update `LLM_PROVIDER` and add keys to `backend/.env`.)*"
    return response


async def rag_query(question: str, session_id: str, doc_ids: Optional[List[str]] = None, stream: bool = True):
    """
    RAG Query orchestrator:
    1. Retrieval: Hybrid search (Dense Cosine + Sparse BM25) and re-ranking.
    2. Memory: Aggregates conversation history context.
    3. LLM Generation: Sends context to OpenAI / Gemini, or triggers local mock responder.
    4. Streaming: Yields formatted SSE event stream messages.
    """
    # 1. Retrieve most relevant context chunks using hybrid retrieval
    results = retrieval.hybrid_retrieve(session_id, question, doc_ids)
    context = "\n\n".join([f"Source: {r['metadata'].get('filename')} (Page {r['metadata'].get('page')})\nContent: {r['text']}" for r in results])

    # 2. Update session conversational memory
    history = _session_memories.setdefault(session_id, [])
    history.append({"role": "user", "content": question})

    # Prepare final citations for the frontend
    sources = [
        {
            "filename": r["metadata"].get("filename", "Unknown"),
            "page": r["metadata"].get("page", 1),
            "text_preview": r["text"][:300],
            "ce_score": r["score"]
        }
        for r in results
    ]

    client = get_llm_client()

    if client is None:
        # Mock/offline RAG response generator
        mock_answer = generate_mock_response(question, results)
        history.append({"role": "assistant", "content": mock_answer})
        
        if stream:
            async def mock_streamer():
                # Stream mock tokens with minor delays to simulate typing
                words = mock_answer.split(" ")
                for i in range(0, len(words), 3):
                    chunk = " ".join(words[i:i+3]) + " "
                    yield f"data: {json.dumps({'token': chunk})}\n\n"
                    await asyncio.sleep(0.05)
                yield f"data: {json.dumps({'done': True, 'sources': sources})}\n\n"
                yield "data: [DONE]\n\n"
            return mock_streamer()
        else:
            return {"answer": mock_answer, "sources": sources}

    # Build Prompt with Context and Memory
    system_prompt = (
        "You are DocuMind Assistant, a helpful AI specialized in document analysis.\n"
        "Use the following retrieved context chunks and conversation history to answer the user's question.\n"
        "Ensure your response is accurate and directly supported by the context. Do not invent facts.\n"
        "If you don't know the answer, say so clearly."
    )
    
    # Format conversational history
    history_context = ""
    for h in history[-5:-1]:  # Include last 4 turns of history
        history_context += f"{h['role'].capitalize()}: {h['content']}\n"
        
    user_prompt = f"Conversational History:\n{history_context}\nRetrieved Document Context:\n{context}\n\nQuestion: {question}\nAnswer:"

    model = config.LLM_MODEL
    if config.LLM_PROVIDER == "gemini" and "gemini" not in model.lower():
        model = "gemini-1.5-flash"

    if stream:
        async def streamer():
            full_text = ""
            try:
                response = await client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    stream=True,
                    temperature=0.3
                )
                async for chunk in response:
                    token = chunk.choices[0].delta.content
                    if token:
                        full_text += token
                        yield f"data: {json.dumps({'token': token})}\n\n"
                
                # Append to history
                history.append({"role": "assistant", "content": full_text})
                # Send sources and terminate SSE stream
                yield f"data: {json.dumps({'done': True, 'sources': sources})}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                err_msg = f"\n\n*Error generating response: {str(e)}*"
                yield f"data: {json.dumps({'token': err_msg})}\n\n"
                yield f"data: {json.dumps({'done': True, 'sources': []})}\n\n"
                yield "data: [DONE]\n\n"
        return streamer()

    # Non-streaming call
    resp = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.3
    )
    answer = resp.choices[0].message.content or ""
    history.append({"role": "assistant", "content": answer})
    return {"answer": answer, "sources": sources}

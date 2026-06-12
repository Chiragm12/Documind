// frontend/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function createSession(name: string) {
  try {
    const res = await fetch(`${API_BASE}/sessions/create?name=${encodeURIComponent(name)}`, {
      method: "POST",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return await res.json();
  } catch (err) {
    console.error("createSession failed", err);
    throw err;
  }
}

export async function listSessions() {
  const res = await fetch(`${API_BASE}/sessions/`);
  return res.json(); // { sessions: [...] }
}

export async function uploadDocument(sessionId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/documents/ingest/${sessionId}`, {
    method: "POST",
    body: form,
  });
  return res.json(); // { doc_id, filename, page_count, chunk_count, summary }
}

export async function listDocuments(sessionId: string) {
  const res = await fetch(`${API_BASE}/documents/${sessionId}`);
  return res.json(); // { documents: [...] }
}

// Streaming chat — returns an async reader
export async function streamChat(
  question: string,
  sessionId: string,
  docIds?: string[]
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const res = await fetch(`${API_BASE}/chat/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, session_id: sessionId, doc_ids: docIds, stream: true }),
  });
  return res.body!.getReader();
}

export async function deleteSession(sessionId: string) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return await res.json();
}
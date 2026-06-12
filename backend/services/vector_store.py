import os
import json
import threading
import numpy as np
from typing import List, Dict, Any, Optional
from pathlib import Path

_lock = threading.Lock()
_stores: Dict[str, Dict[str, Any]] = {}

MODEL_NAME = os.environ.get("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
try:
	from sentence_transformers import SentenceTransformer
	_embed_model = SentenceTransformer(MODEL_NAME)
except Exception:
	_embed_model = None


def _storage_path(session_id: str) -> str:
	base = Path(__file__).parent.parent / "data" / "vector_store"
	base.mkdir(parents=True, exist_ok=True)
	return str(base / f"{session_id}.npz")


def _ensure_store(session_id: str):
	with _lock:
		if session_id in _stores:
			return _stores[session_id]
		path = _storage_path(session_id)
		if os.path.exists(path):
			d = np.load(path, allow_pickle=True)
			store = {
				"embeddings": d["embeddings"].tolist(),
				"texts": d["texts"].tolist(),
				"metadatas": d["metadatas"].tolist(),
			}
		else:
			store = {"embeddings": [], "texts": [], "metadatas": []}
		_stores[session_id] = store
		return store


def _persist(session_id: str):
	with _lock:
		store = _stores.get(session_id)
		if not store:
			return
		path = _storage_path(session_id)
		np.savez(path, embeddings=np.array(store["embeddings"]), texts=np.array(store["texts"], dtype=object), metadatas=np.array(store["metadatas"], dtype=object))


def _embed_texts(texts: List[str]) -> List[List[float]]:
	if _embed_model is not None:
		embs = _embed_model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
		return embs.tolist()
	# fallback: simple TF-IDF-ish numericization via hashing
	import hashlib
	out = []
	for t in texts:
		h = hashlib.sha256(t.encode()[:1024]).digest()
		vec = [b / 255.0 for b in h[:32]]
		out.append(vec)
	return out


def add_embeddings(session_id: str, doc_id: str, chunk_ids: List[str], texts: List[str], metadatas: Optional[List[dict]] = None):
	store = _ensure_store(session_id)
	embs = _embed_texts(texts)
	for i, (cid, txt, emb) in enumerate(zip(chunk_ids, texts, embs)):
		meta = {"doc_id": doc_id, "chunk_id": cid}
		if metadatas and i < len(metadatas):
			meta.update(metadatas[i])
		store["embeddings"].append(np.array(emb, dtype=float))
		store["texts"].append(txt)
		store["metadatas"].append(meta)
	_persist(session_id)


def query(session_id: str, query_text: str, top_k: int = 5) -> List[Dict[str, Any]]:
	store = _ensure_store(session_id)
	if not store["embeddings"]:
		return []
	q_emb = _embed_texts([query_text])[0]
	embs = np.array(store["embeddings"])
	# cosine similarity
	q = np.array(q_emb)
	dots = embs @ q
	norms = np.linalg.norm(embs, axis=1) * (np.linalg.norm(q) + 1e-12)
	sims = dots / norms
	idx = np.argsort(-sims)[:top_k]
	results = []
	for i in idx:
		results.append({"score": float(sims[i]), "text": store["texts"][i], "metadata": store["metadatas"][i]})
	return results


def delete_doc_vectors(session_id: str, doc_id: str):
	store = _ensure_store(session_id)
	new_emb = []
	new_texts = []
	new_meta = []
	for emb, txt, m in zip(store["embeddings"], store["texts"], store["metadatas"]):
		if m.get("doc_id") == doc_id:
			continue
		new_emb.append(emb)
		new_texts.append(txt)
		new_meta.append(m)
	store["embeddings"] = new_emb
	store["texts"] = new_texts
	store["metadatas"] = new_meta
	_persist(session_id)


def delete_namespace(session_id: str):
	with _lock:
		if session_id in _stores:
			del _stores[session_id]
		path = _storage_path(session_id)
		try:
			os.remove(path)
		except Exception:
			pass


def get_all_texts(session_id: str):
	store = _ensure_store(session_id)
	return store["texts"]


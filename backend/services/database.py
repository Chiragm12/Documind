import sqlite3
import os
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "../data/documind.db")


def _conn():
	os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
	return sqlite3.connect(DB_PATH)


def init_db():
	conn = _conn()
	cur = conn.cursor()
	cur.execute(
		"""
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			name TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
		"""
	)
	cur.execute(
		"""
		CREATE TABLE IF NOT EXISTS documents (
			id TEXT PRIMARY KEY,
			session_id TEXT,
			filename TEXT,
			page_count INTEGER,
			chunk_count INTEGER,
			preview_text TEXT,
			summary TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
		"""
	)
	cur.execute(
		"""
		CREATE TABLE IF NOT EXISTS chunks (
			id TEXT PRIMARY KEY,
			doc_id TEXT,
			session_id TEXT,
			chunk_index INTEGER,
			page_number INTEGER,
			text TEXT
		)
		"""
	)
	# Schema Migration: Add page_number column if it doesn't exist
	cur.execute("PRAGMA table_info(chunks)")
	columns = [col[1] for col in cur.fetchall()]
	if "page_number" not in columns:
		try:
			cur.execute("ALTER TABLE chunks ADD COLUMN page_number INTEGER DEFAULT 1")
		except Exception:
			pass
	conn.commit()
	conn.close()


def create_session(session_id: str, name: str = "Untitled Session"):
	conn = _conn()
	cur = conn.cursor()
	cur.execute("INSERT OR REPLACE INTO sessions (id, name) VALUES (?,?)", (session_id, name))
	conn.commit()
	conn.close()


def list_sessions() -> List[Dict[str, Any]]:
	conn = _conn()
	cur = conn.cursor()
	cur.execute("SELECT id, name, created_at FROM sessions ORDER BY created_at DESC")
	rows = cur.fetchall()
	conn.close()
	return [dict(session_id=r[0], name=r[1], created_at=r[2]) for r in rows]


def insert_document(doc_id: str, session_id: str, filename: str, page_count: int, chunk_count: int, preview_text: str = ""):
	conn = _conn()
	cur = conn.cursor()
	cur.execute(
		"INSERT OR REPLACE INTO documents (id, session_id, filename, page_count, chunk_count, preview_text) VALUES (?,?,?,?,?,?)",
		(doc_id, session_id, filename, page_count, chunk_count, preview_text),
	)
	conn.commit()
	conn.close()


def update_document_summary(doc_id: str, summary: str):
	conn = _conn()
	cur = conn.cursor()
	cur.execute("UPDATE documents SET summary = ? WHERE id = ?", (summary, doc_id))
	conn.commit()
	conn.close()


def list_documents(session_id: str):
	conn = _conn()
	cur = conn.cursor()
	cur.execute(
		"SELECT id, filename, page_count, chunk_count, summary, created_at FROM documents WHERE session_id = ? ORDER BY created_at",
		(session_id,)
	)
	rows = cur.fetchall()
	conn.close()
	return [dict(id=r[0], filename=r[1], page_count=r[2], chunk_count=r[3], summary=r[4], created_at=r[5]) for r in rows]


def delete_document(doc_id: str):
	conn = _conn()
	cur = conn.cursor()
	cur.execute("DELETE FROM chunks WHERE doc_id = ?", (doc_id,))
	cur.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
	conn.commit()
	conn.close()


def delete_session(session_id: str):
	conn = _conn()
	cur = conn.cursor()
	# delete chunks for documents in this session
	cur.execute("DELETE FROM chunks WHERE session_id = ?", (session_id,))
	cur.execute("DELETE FROM documents WHERE session_id = ?", (session_id,))
	cur.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
	conn.commit()
	conn.close()


def insert_chunk(chunk_id: str, doc_id: str, session_id: str, chunk_index: int, page_number: int, text: str):
	conn = _conn()
	cur = conn.cursor()
	cur.execute("INSERT OR REPLACE INTO chunks (id, doc_id, session_id, chunk_index, page_number, text) VALUES (?,?,?,?,?,?)",
				(chunk_id, doc_id, session_id, chunk_index, page_number, text))
	conn.commit()
	conn.close()


def get_chunks_for_session(session_id: str):
	conn = _conn()
	cur = conn.cursor()
	cur.execute("SELECT id, doc_id, page_number, chunk_index, text FROM chunks WHERE session_id = ? ORDER BY doc_id, chunk_index", (session_id,))
	rows = cur.fetchall()
	conn.close()
	return [dict(id=r[0], doc_id=r[1], page_number=r[2], chunk_index=r[3], text=r[4]) for r in rows]


def get_chunks_for_session_docs(session_id: str, doc_ids: Optional[List[str]] = None) -> List[Dict[str, Any]]:
	conn = _conn()
	cur = conn.cursor()
	if doc_ids and len(doc_ids) > 0:
		placeholders = ",".join("?" for _ in doc_ids)
		cur.execute(
			f"SELECT chunks.id, chunks.doc_id, chunks.page_number, chunks.chunk_index, chunks.text, documents.filename "
			f"FROM chunks JOIN documents ON chunks.doc_id = documents.id "
			f"WHERE chunks.session_id = ? AND chunks.doc_id IN ({placeholders}) "
			f"ORDER BY chunks.doc_id, chunks.page_number, chunks.chunk_index",
			(session_id, *doc_ids)
		)
	else:
		cur.execute(
			"SELECT chunks.id, chunks.doc_id, chunks.page_number, chunks.chunk_index, chunks.text, documents.filename "
			"FROM chunks JOIN documents ON chunks.doc_id = documents.id "
			"WHERE chunks.session_id = ? "
			"ORDER BY chunks.doc_id, chunks.page_number, chunks.chunk_index",
			(session_id,)
		)
	rows = cur.fetchall()
	conn.close()
	return [
		{
			"id": r[0],
			"doc_id": r[1],
			"page": r[2],
			"chunk_index": r[3],
			"text": r[4],
			"filename": r[5]
		}
		for r in rows
	]


def get_document_preview(doc_id: str) -> str:
	conn = _conn()
	cur = conn.cursor()
	cur.execute("SELECT preview_text FROM documents WHERE id = ?", (doc_id,))
	row = cur.fetchone()
	conn.close()
	return row[0] if row else ""


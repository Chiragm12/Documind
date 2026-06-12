# backend/services/ingestion.py
import uuid
import math
from typing import Tuple, List
from io import BytesIO
from backend.services import database, vector_store
from backend import config

try:
	from PyPDF2 import PdfReader
except Exception:
	PdfReader = None


def _extract_text_from_pdf_bytes(file_bytes: bytes) -> List[str]:
	if PdfReader is None:
		raise RuntimeError("PyPDF2 is required to extract PDF text. Install with 'pip install PyPDF2'.")
	reader = PdfReader(BytesIO(file_bytes))
	pages = []
	for p in reader.pages:
		try:
			pages.append(p.extract_text() or "")
		except Exception:
			pages.append("")
	return pages


def _chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> List[str]:
	if not text:
		return []
	chunks = []
	start = 0
	L = len(text)
	while start < L:
		end = min(start + chunk_size, L)
		chunk = text[start:end]
		chunks.append(chunk.strip())
		# Advance start position by chunk_size - overlap
		start = max(end - overlap, end)
	return chunks


async def ingest_document(file_bytes: bytes, filename: str, session_id: str) -> dict:
	# extract pages
	pages = _extract_text_from_pdf_bytes(file_bytes)
	all_chunks = []
	chunk_ids = []
	doc_id = str(uuid.uuid4())
	
	chunk_size = config.CHUNK_SIZE
	overlap = config.CHUNK_OVERLAP

	for pi, page_text in enumerate(pages):
		# Chunk the text of this specific page
		page_chunks = _chunk_text(page_text, chunk_size=chunk_size, overlap=overlap)
		for ci, ch in enumerate(page_chunks):
			cid = str(uuid.uuid4())
			chunk_ids.append(cid)
			all_chunks.append((cid, ch, pi + 1))  # (id, text, page_number)
			
			# Persist chunk record in SQLite database (with 1-based page index)
			database.insert_chunk(
				chunk_id=cid,
				doc_id=doc_id,
				session_id=session_id,
				chunk_index=ci,
				page_number=pi + 1,
				text=ch
			)

	# Store document preview (e.g. first 1000 characters of page 1)
	preview = pages[0][:1000] if pages else ""
	database.insert_document(doc_id, session_id, filename, len(pages), len(all_chunks), preview)

	# Build lists of texts, chunk IDs, and metadata for vector store
	texts = [c[1] for c in all_chunks]
	ids = [c[0] for c in all_chunks]
	# Extra metadata payload for neural semantic queries
	metadatas = [{"page": c[2], "filename": filename} for c in all_chunks]
	
	# Index chunks in local numpy vector store
	vector_store.add_embeddings(session_id, doc_id, ids, texts, metadatas)

	return {
		"doc_id": doc_id,
		"filename": filename,
		"page_count": len(pages),
		"chunk_count": len(all_chunks)
	}

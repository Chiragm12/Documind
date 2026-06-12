# backend/services/retrieval.py
import math
import os
from typing import List, Dict, Any, Optional
from backend.services import database, vector_store
from backend import config

# Try to load a CrossEncoder model for neural re-ranking
try:
    from sentence_transformers import CrossEncoder
    MODEL_NAME = os.environ.get("RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
    _rerank_model = CrossEncoder(MODEL_NAME)
except Exception:
    _rerank_model = None


class BM25Retriever:
    """
    A lightweight, robust, pure-Python BM25 keyword ranker.
    Keeps dependencies small and avoids downloading tokenizer files/NLTK databases.
    """
    def __init__(self, corpus: List[Dict[str, Any]], k1: float = 1.5, b: float = 0.75):
        self.corpus = corpus  # Each dict: {"id":..., "text":..., "doc_id":..., "filename":..., "page":...}
        self.k1 = k1
        self.b = b
        self.doc_len = []
        self.doc_freqs = []
        self.avg_doc_len = 0.0
        self.idf = {}
        self.nd = len(corpus)
        self._initialize()

    def _tokenize(self, text: str) -> List[str]:
        # Basic word tokenization (removes punctuation and lowercase)
        import re
        words = re.findall(r"\b[a-zA-Z0-9]{2,}\b", text.lower())
        return words

    def _initialize(self):
        total_len = 0
        for doc in self.corpus:
            tokens = self._tokenize(doc["text"])
            self.doc_len.append(len(tokens))
            total_len += len(tokens)
            
            freqs = {}
            for token in tokens:
                freqs[token] = freqs.get(token, 0) + 1
            self.doc_freqs.append(freqs)
            
        self.avg_doc_len = total_len / self.nd if self.nd > 0 else 0.0
        
        # Calculate doc frequency (DF) for each term
        for freqs in self.doc_freqs:
            for token in freqs.keys():
                self.idf[token] = self.idf.get(token, 0) + 1
                
        # Calculate IDF
        for token, df in self.idf.items():
            # Standard BM25 IDF formulation
            self.idf[token] = math.log((self.nd - df + 0.5) / (df + 0.5) + 1.0)

    def query(self, query_text: str, top_k: int = 5) -> List[Dict[str, Any]]:
        q_tokens = self._tokenize(query_text)
        scores = []
        for idx, doc in enumerate(self.corpus):
            score = 0.0
            freqs = self.doc_freqs[idx]
            d_len = self.doc_len[idx]
            for token in q_tokens:
                if token not in freqs:
                    continue
                tf = freqs[token]
                idf_val = self.idf.get(token, 0.0)
                # BM25 term weighting formula
                numerator = idf_val * tf * (self.k1 + 1.0)
                denominator = tf + self.k1 * (1.0 - self.b + self.b * d_len / (self.avg_doc_len + 1e-12))
                score += numerator / denominator
            scores.append((score, doc))
        
        # Sort scores descending
        scores.sort(key=lambda x: x[0], reverse=True)
        
        results = []
        for score, doc in scores[:top_k]:
            results.append({
                "score": score,
                "text": doc["text"],
                "metadata": {
                    "doc_id": doc["doc_id"],
                    "chunk_id": doc["id"],
                    "filename": doc["filename"],
                    "page": doc["page"]
                }
            })
        return results


def hybrid_retrieve(session_id: str, query_text: str, doc_ids: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Hybrid Retrieval Strategy:
    1. Dense Search (Semantic Similarity via vector store)
    2. Sparse Search (Keyword Relevance via local BM25)
    3. Union pooling
    4. Neural Re-ranking (CrossEncoder) or Reciprocal Rank Fusion (RRF) fallback
    """
    dense_k = config.DENSE_TOP_K
    sparse_k = config.SPARSE_TOP_K
    rerank_k = config.RERANK_TOP_K

    # 1. Dense Semantic Search
    dense_results = vector_store.query(session_id, query_text, top_k=dense_k)
    
    # Filter dense results if doc_ids is specified
    if doc_ids and len(doc_ids) > 0:
        dense_results = [r for r in dense_results if r["metadata"].get("doc_id") in doc_ids]

    # 2. Sparse Keyword Search
    # Get all chunks matching the session (and optional document IDs)
    all_chunks = database.get_chunks_for_session_docs(session_id, doc_ids)
    if not all_chunks:
        # If no documents ingested yet, return empty list
        return []
        
    bm25 = BM25Retriever(all_chunks)
    sparse_results = bm25.query(query_text, top_k=sparse_k)

    # 3. Merge candidates and record rankings
    candidate_dict = {}
    
    # Process dense results
    for rank, res in enumerate(dense_results):
        cid = res["metadata"]["chunk_id"]
        candidate_dict[cid] = {
            "chunk_id": cid,
            "doc_id": res["metadata"]["doc_id"],
            "filename": res["metadata"].get("filename", "Unknown"),
            "page": res["metadata"].get("page", 1),
            "text": res["text"],
            "dense_score": res["score"],
            "dense_rank": rank + 1,
            "sparse_rank": None,
            "sparse_score": None
        }

    # Process sparse results
    for rank, res in enumerate(sparse_results):
        cid = res["metadata"]["chunk_id"]
        if cid in candidate_dict:
            candidate_dict[cid]["sparse_rank"] = rank + 1
            candidate_dict[cid]["sparse_score"] = res["score"]
        else:
            candidate_dict[cid] = {
                "chunk_id": cid,
                "doc_id": res["metadata"]["doc_id"],
                "filename": res["metadata"].get("filename", "Unknown"),
                "page": res["metadata"].get("page", 1),
                "text": res["text"],
                "dense_score": None,
                "dense_rank": None,
                "sparse_rank": rank + 1,
                "sparse_score": res["score"]
            }

    candidates = list(candidate_dict.values())

    # 4. Re-ranking
    if _rerank_model is not None:
        try:
            pairs = [[query_text, c["text"]] for c in candidates]
            # Cross-encoder outputs similarity logit
            ce_scores = _rerank_model.predict(pairs)
            for c, score in zip(candidates, ce_scores):
                c["ce_score"] = float(score)
            candidates.sort(key=lambda x: x["ce_score"], reverse=True)
        except Exception:
            _apply_rrf(candidates)
    else:
        _apply_rrf(candidates)

    # Take top K results
    top_candidates = candidates[:rerank_k]

    # Format output consistently for RAG
    results = []
    for c in top_candidates:
        score = c.get("ce_score") if c.get("ce_score") is not None else c.get("rrf_score", 0.0)
        results.append({
            "score": score,
            "text": c["text"],
            "metadata": {
                "doc_id": c["doc_id"],
                "chunk_id": c["chunk_id"],
                "filename": c["filename"],
                "page": c["page"],
                "ce_score": c.get("ce_score")
            }
        })
    return results


def _apply_rrf(candidates: List[dict], k: float = 60.0):
    """
    Applies Reciprocal Rank Fusion (RRF) to merge rankings:
    RRF_Score(doc) = 1 / (k + dense_rank) + 1 / (k + sparse_rank)
    """
    for c in candidates:
        score = 0.0
        if c["dense_rank"] is not None:
            score += 1.0 / (k + c["dense_rank"])
        if c["sparse_rank"] is not None:
            score += 1.0 / (k + c["sparse_rank"])
        c["rrf_score"] = score
    candidates.sort(key=lambda x: x["rrf_score"], reverse=True)

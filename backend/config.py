# backend/config.py
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "openai").lower()  # 'openai' or 'gemini' or 'mock'
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")

# Chunking configurations
CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", 800))
CHUNK_OVERLAP = int(os.environ.get("CHUNK_OVERLAP", 100))

# Search & Retrieval configurations
DENSE_TOP_K = int(os.environ.get("DENSE_TOP_K", 20))
SPARSE_TOP_K = int(os.environ.get("SPARSE_TOP_K", 20))
RERANK_TOP_K = int(os.environ.get("RERANK_TOP_K", 5))

def is_llm_configured() -> bool:
    if LLM_PROVIDER == "openai" and OPENAI_API_KEY and not OPENAI_API_KEY.startswith("sk-..."):
        return True
    if LLM_PROVIDER == "gemini" and GEMINI_API_KEY and not GEMINI_API_KEY.startswith("..."):
        return True
    # If keys are defined but they are defaults or missing
    return False

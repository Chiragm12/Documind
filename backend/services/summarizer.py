# backend/services/summarizer.py
import re
import json
from backend.services import database
from backend.services.rag_chain import get_llm_client, call_llm_non_streaming

def _top_sentences(text: str, n: int = 3) -> str:
	# naive sentence splitter
	sents = re.split(r'(?<=[.!?])\s+', text)
	sents = [s.strip() for s in sents if s.strip()]
	return " ".join(sents[:n])


def _extract_keywords(text: str, top_k: int = 6):
	words = re.findall(r"\b[a-zA-Z]{4,}\b", text.lower())
	# simple stop words filter
	stop_words = {
		"the", "and", "this", "that", "with", "from", "they", "them", 
		"their", "these", "were", "been", "have", "here", "there", "about"
	}
	words = [w for w in words if w not in stop_words]
	freq = {}
	for w in words:
		freq[w] = freq.get(w, 0) + 1
	items = sorted(freq.items(), key=lambda x: -x[1])[:top_k]
	# capitalize keywords for better visual presentation
	return [w.capitalize() for w, _ in items]


async def generate_summary_and_mindmap(doc_id: str, preview_text: str = "") -> dict:
	preview = preview_text or database.get_document_preview(doc_id)
	if not preview:
		return {"summary": "", "mindmap": {"root": doc_id, "keywords": []}}

	# Try to use LLM if available
	client = get_llm_client()
	if client is not None:
		try:
			prompt = (
				f"Analyze the following document text excerpt and generate:\n"
				f"1. A concise summary of 3-4 sentences.\n"
				f"2. A list of exactly 6 key concepts or keywords (short phrases, capitalize each word) for a mind map.\n\n"
				f"Text:\n{preview[:3000]}\n\n"
				f"Format the output strictly as JSON with exactly two keys: 'summary' and 'keywords'. Do not add any explanation or markdown formatting outside the JSON.\n"
				f"Example format:\n"
				f"{{\n"
				f"  \"summary\": \"The document describes...\",\n"
				f"  \"keywords\": [\"Artificial Intelligence\", \"Vector Database\", \"Text Chunking\", \"Python\", \"API\", \"Machine Learning\"]\n"
				f"}}"
			)
			response = await call_llm_non_streaming(prompt, system_prompt="You are a helpful AI assistant that summarizes documents and outputs JSON.")
			
			# Clean markdown code blocks if the model wrapped them
			clean_response = response.strip()
			if clean_response.startswith("```"):
				lines = clean_response.splitlines()
				if lines[0].startswith("```"):
					lines = lines[1:]
				if lines[-1].startswith("```"):
					lines = lines[:-1]
				clean_response = "\n".join(lines).strip()
				
			data = json.loads(clean_response)
			summary_text = data.get("summary", "")
			keywords = data.get("keywords", [])
			if not isinstance(keywords, list):
				keywords = []
			keywords = [str(k).title() for k in keywords][:6]
			
			return {
				"summary": summary_text,
				"mindmap": {"root": doc_id, "keywords": keywords}
			}
		except Exception as e:
			# Fall back to extractive approach on exception
			pass

	# Local extractive fallback (naive summary and keyword extraction)
	summary_text = _top_sentences(preview, n=4)
	keywords = _extract_keywords(preview + " " + summary_text, top_k=6)
	return {
		"summary": summary_text,
		"mindmap": {"root": doc_id, "keywords": keywords}
	}

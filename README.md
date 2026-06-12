# DocuMind 🧠📄
An AI-powered document analysis and chat platform built with Next.js, FastAPI, SQLite, and NumPy. Upload PDFs, automatically generate summaries and interactive mind maps, and chat with your documents using OpenAI's ChatGPT, Google Gemini, or a fully functional offline simulation mode.
---
## 🌟 Features
*   **Multi-Document Chat Sessions**: Create separate sessions to upload and chat with multiple PDF documents simultaneously.
*   **Automatic Summarization**: Instantly generates a concise 3-4 sentence summary of any uploaded PDF.
*   **Interactive Mind Maps**: Uses D3.js to dynamically render a visual mind map representing key concepts extracted from your documents.
*   **Dual LLM Engine Support**: Seamlessly switch between **OpenAI (ChatGPT)** and **Google Gemini** (via OpenAI-compatible endpoint).
*   **Offline/Simulation Mode**: Don't have an API key? The application will fall back to local extractive summarization, TF-IDF concept mapping, and mock RAG simulation mode so you can test all features offline.
*   **Local Hybrid Semantic Search**: Combines a local lightweight embedding database with NumPy-powered cosine similarity. Supports upgrading to high-fidelity semantic embeddings via `SentenceTransformer` (`all-MiniLM-L6-v2`).
*   **SSE Streaming Chat**: Real-time streaming answers for a fluid, responsive chat experience.
*   **Conversational Memory**: Remembers context across turns in the chat to support natural follow-up questions.
---
## 🛠️ Tech Stack
### Frontend
*   **Framework**: [Next.js 14](https://nextjs.org/) (React 18)
*   **Language**: TypeScript
*   **Styling**: TailwindCSS
*   **Visualizations**: D3.js (for rendering interactive mind maps)
*   **Components**: Radix UI Dialog, Lucide React icons, React Dropzone
### Backend
*   **API Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
*   **Database**: SQLite (local structured metadata and conversational context storage)
*   **Vector Search**: NumPy-based local cosine similarity index with `.npz` storage
*   **Text Extraction & Processing**: PyPDF2 with overlapping sliding window chunking
---
## 🚀 Getting Started
### Prerequisites
*   Node.js (v18.x or later)
*   Python (v3.10 or later)
---
### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   # On Windows
   python -m venv .venv
   .venv\Scripts\activate
   # On macOS/Linux
   python -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
   > [!NOTE]
   > To keep setup lightweight, `sentence-transformers` and `torch` are omitted from the default setup, falling back to a quick hashing-based embedding scheme. If you wish to use full high-quality semantic embeddings, install them manually inside your virtual environment:
   > ```bash
   > pip install sentence-transformers torch
   > ```
4. Create your `.env` configuration file in the `backend/` folder (or copy from existing values):
   ```env
   # API Keys
   OPENAI_API_KEY=your-openai-api-key
   GEMINI_API_KEY=your-gemini-api-key
   # Configuration
   LLM_PROVIDER=openai # Set to 'openai' or 'gemini'
   LLM_MODEL=gpt-4o-mini
   ```
5. Run the FastAPI server:
   ```bash
   python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```
---
### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env.local` configuration file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to start using DocuMind!
---
## 📂 Project Structure
```text
DocuMind/
├── backend/
│   ├── data/                 # SQLite DB and local NumPy vector stores
│   ├── routers/              # FastAPI routers (chat, docs, sessions)
│   ├── services/             # Core logic (RAG, database, ingestion, summarization)
│   ├── config.py             # Config & env loader
│   ├── main.py               # API Entrypoint
│   └── requirements.txt      # Backend Python dependencies
├── frontend/
│   ├── app/                  # Next.js App Router (pages and layouts)
│   ├── components/           # UI components (Chat, Dropzone, Mindmap)
│   ├── lib/                  # Helper utilities and API handlers
│   └── package.json          # Node dependencies & scripts
└── supabase/                 # Database migrations (optional)
```
---
## 🔑 Environment Configuration Detail
In [backend/.env](file:///d:/Documind/backend/.env), you can fine-tune your configuration:
*   `LLM_PROVIDER`: Select either `openai` or `gemini`.
*   `LLM_MODEL`: Set model version (e.g. `gpt-4o-mini`, `gpt-4o`, `gemini-1.5-flash`).
*   `CHUNK_SIZE`: Word-level size of chunks (default: `800`).
*   `CHUNK_OVERLAP`: Overlap between adjacent chunks (default: `100`).
*   `DENSE_TOP_K`: Number of dense vectors to fetch (default: `20`).
*   `RERANK_TOP_K`: Number of context chunks returned to the LLM (default: `5`).
---
## 📄 License
This project is licensed under the MIT License.

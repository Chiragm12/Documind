// frontend/app/page.tsx
"use client";
import React, { useState, useEffect } from "react";
import { Plus, MessageSquare, FileText, Network, Trash2, Layers } from "lucide-react";
import ChatWindow from "../components/ChatWindow";
import DocumentPanel from "../components/DocumentPanel";
import MindMap from "../components/MindMap";
import { listSessions, createSession, deleteSession, listDocuments } from "../lib/api";

type Session = { session_id: string; name: string; created_at?: string };

export default function Home({ sessionId }: { sessionId?: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(sessionId || null);
  const [activeTab, setActiveTab] = useState<"chat" | "documents" | "mindmap">("chat");
  const [sessionDocs, setSessionDocs] = useState<any[]>([]);
  const [filterDocIds, setFilterDocIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].session_id);
    }
  }, [sessions, selectedSessionId]);

  // Automatically fetch documents when the selected workspace session changes
  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionDocuments(selectedSessionId);
    } else {
      setSessionDocs([]);
    }
    setFilterDocIds([]); // Reset document filter when switching sessions
  }, [selectedSessionId]);

  async function fetchSessionDocuments(id: string) {
    try {
      const res = await listDocuments(id);
      setSessionDocs(res.documents || []);
    } catch (e) {
      console.error("Failed to load session documents", e);
    }
  }

  async function fetchSessions() {
    try {
      const res = await listSessions();
      const loaded = res.sessions || [];
      setSessions(loaded);
      if (loaded.length > 0 && !selectedSessionId) {
        setSelectedSessionId(loaded[0].session_id);
      }
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  }

  async function handleCreateSession() {
    if (creating) return;
    setCreating(true);
    try {
      const num = sessions.length + 1;
      const res = await createSession(`Workspace Session #${num}`);
      await fetchSessions();
      setSelectedSessionId(res.session_id);
      setActiveTab("documents"); // Switch to document upload on new session
    } catch (e) {
      console.error(e);
      alert("Failed to create session. Please make sure your backend server is running on http://127.0.0.1:8000!");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this session?")) return;
    try {
      await deleteSession(id);
      if (selectedSessionId === id) {
        setSelectedSessionId(null);
      }
      await fetchSessions();
    } catch (err) {
      console.error(err);
      alert("Failed to delete workspace session. Make sure the backend is active.");
    }
  }

  const activeSessionName = sessions.find(s => s.session_id === selectedSessionId)?.name || "Default Session";

  return (
    <div className="flex h-screen bg-[#090d16] text-[#f8fafc] overflow-hidden font-sans">
      {/* Sidebar Panel */}
      <aside className="w-80 border-r border-slate-800 bg-[#0f172a]/90 flex flex-col justify-between">
        <div>
          {/* Brand Logo Header */}
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-teal-500/20">
              D
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-wide bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                DocuMind
              </h1>
              <p className="text-[10px] text-slate-500 tracking-wider font-semibold uppercase">
                AI Document Intelligence
              </p>
            </div>
          </div>

          {/* New Session Button */}
          <div className="p-4">
            <button
              onClick={handleCreateSession}
              disabled={creating}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg transition-all shadow-md shadow-teal-600/10 hover:shadow-teal-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Workspace
            </button>
          </div>

          {/* Sessions List */}
          <div className="px-3 py-2">
            <p className="px-3 text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-2">
              Workspaces
            </p>
            <div className="space-y-1 max-h-[220px] overflow-y-auto px-1">
              {sessions.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-500 italic">No workspaces created yet.</p>
              ) : (
                sessions.map(s => (
                  <div
                    key={s.session_id}
                    onClick={() => {
                      setSelectedSessionId(s.session_id);
                      setFilterDocIds([]); // Reset document filter when switching sessions
                    }}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-all ${
                      selectedSessionId === s.session_id
                        ? "bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Layers className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{s.name}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(s.session_id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 rounded transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Documents Selection Filter */}
          {selectedSessionId && sessionDocs.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-800/80 mt-2">
              <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-3">
                Focus Documents ({sessionDocs.length})
              </p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {sessionDocs.map(d => {
                  const isChecked = filterDocIds.includes(d.id);
                  return (
                    <label
                      key={d.id}
                      className="flex items-start gap-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setFilterDocIds(prev => prev.filter(id => id !== d.id));
                          } else {
                            setFilterDocIds(prev => [...prev, d.id]);
                          }
                        }}
                        className="mt-0.5 accent-teal-500 cursor-pointer"
                      />
                      <span className="truncate leading-normal" title={d.filename}>
                        {d.filename}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[9px] text-slate-500 mt-2 italic leading-relaxed">
                {filterDocIds.length > 0
                  ? "Retrieval is locked to selected docs."
                  : "Retrieval is searching all ingested docs."}
              </p>
            </div>
          )}
        </div>

        {/* Technical Stack Status Footer */}
        <div className="p-6 border-t border-slate-800 bg-[#0a0d16]/30 text-[10px] text-slate-500">
          <div className="flex items-center justify-between mb-1.5">
            <span>LLM Platform</span>
            <span className="text-teal-400 font-semibold uppercase">RAG + Hybrid</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Database</span>
            <span className="text-slate-300 font-medium">SQLite (Local)</span>
          </div>
        </div>
      </aside>

      {/* Main Content Dashboard Panel */}
      <main className="flex-1 flex flex-col bg-[#090d16] relative overflow-hidden">
        {selectedSessionId ? (
          <>
            {/* Top Workspace Bar */}
            <header className="h-16 border-b border-slate-800/80 px-8 flex items-center justify-between bg-[#0f172a]/20">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-200">{activeSessionName}</h2>
                  <p className="text-[10px] text-slate-500">
                    Workspace session ID: <span className="font-mono">{selectedSessionId}</span>
                  </p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex bg-[#1e293b]/40 p-1 rounded-lg border border-slate-800/80">
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    activeTab === "chat"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Chat Assistant
                </button>
                <button
                  onClick={() => setActiveTab("documents")}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    activeTab === "documents"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Documents
                </button>
                <button
                  onClick={() => setActiveTab("mindmap")}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    activeTab === "mindmap"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Network className="w-3.5 h-3.5" />
                  Mind Map
                </button>
              </div>
            </header>

            {/* Main Panel Content Box */}
            <div className="flex-1 overflow-hidden p-8">
              {activeTab === "chat" && (
                <div className="h-full glass-panel rounded-2xl overflow-hidden shadow-2xl">
                  <ChatWindow sessionId={selectedSessionId} docIds={filterDocIds} />
                </div>
              )}
              {activeTab === "documents" && (
                <div className="h-full overflow-y-auto pr-1">
                  <DocumentPanel
                    sessionId={selectedSessionId}
                    onDocumentsChange={setSessionDocs}
                  />
                </div>
              )}
              {activeTab === "mindmap" && (
                <div className="h-full glass-panel rounded-2xl p-6 flex flex-col shadow-2xl">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-200">Interactive Concept Map</h3>
                    <p className="text-xs text-slate-400">
                      Force-directed concept network mapping keywords extracted from ingested workspace PDFs. Drag to restructure, scroll to zoom.
                    </p>
                  </div>
                  <div className="flex-1 rounded-xl bg-[#030712]/50 border border-slate-800/50 overflow-hidden relative min-h-[300px]">
                    <MindMap sessionId={selectedSessionId} documents={sessionDocs} />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty / Welcome Screen */
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#090d16] text-center">
            <div className="max-w-md p-8 rounded-2xl bg-[#0f172a]/40 border border-slate-800/80 shadow-2xl flex flex-col items-center">
              <div className="w-16 h-16 bg-teal-500/10 rounded-2xl flex items-center justify-center text-teal-400 mb-6 border border-teal-500/20 shadow-lg shadow-teal-500/5">
                <Layers className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-2">Welcome to DocuMind</h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                An intelligence system powered by hybrid vector search (dense semantic semantic and sparse BM25) and neural re-ranking. Select an existing workspace session or create a new one to begin.
              </p>
              <button
                onClick={handleCreateSession}
                disabled={creating}
                className="flex items-center gap-2 py-3 px-6 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg transition-all shadow-md shadow-teal-600/10 cursor-pointer"
              >
                <Plus className="w-4.5 h-4.5" />
                Initialize Workspace
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

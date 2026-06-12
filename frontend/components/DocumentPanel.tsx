// frontend/components/DocumentPanel.tsx
"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, Trash2, Loader2, Eye, Calendar, Sparkles } from "lucide-react";
import { uploadDocument, listDocuments } from "../lib/api";

type Document = {
  id: string;
  filename: string;
  page_count: number;
  chunk_count: number;
  summary?: string; // Stored as a serialized JSON string
  created_at: string;
};

type Props = {
  sessionId: string;
  onDocumentsChange?: (docs: Document[]) => void;
};

export default function DocumentPanel({ sessionId, onDocumentsChange }: Props) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDocuments(sessionId);
      const list = res.documents || [];
      setDocs(list);
      if (onDocumentsChange) onDocumentsChange(list);
    } catch (e) {
      console.error("Failed to load documents", e);
    } finally {
      setLoading(false);
    }
  }, [sessionId, onDocumentsChange]);

  useEffect(() => {
    fetchDocs();
    setSelectedDocId(null);
  }, [sessionId, fetchDocs]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      setUploading(true);
      try {
        await uploadDocument(sessionId, file);
        await fetchDocs();
      } catch (err) {
        console.error("Upload failed", err);
        alert("Upload failed. Ensure backend is running and the file is a PDF.");
      } finally {
        setUploading(false);
      }
    },
    [sessionId, fetchDocs]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  });

  async function handleDelete(docId: string, event: React.MouseEvent) {
    event.stopPropagation();
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${API_BASE}/documents/${docId}?session_id=${sessionId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      if (selectedDocId === docId) setSelectedDocId(null);
      await fetchDocs();
    } catch (err) {
      console.error(err);
      alert("Failed to delete document");
    }
  }

  const selectedDoc = docs.find((d) => d.id === selectedDocId);
  let parsedSummary: { summary: string; mindmap?: { keywords: string[] } } | null = null;
  if (selectedDoc?.summary) {
    try {
      parsedSummary = JSON.parse(selectedDoc.summary);
    } catch (e) {
      // summary might be unparsed or simple string
      parsedSummary = { summary: selectedDoc.summary };
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
      {/* Upload Zone & Documents List (Span 2) */}
      <div className="xl:col-span-2 space-y-6">
        {/* Upload Container Box */}
        <div
          {...getRootProps()}
          className={`glass-panel border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
            isDragActive
              ? "border-teal-500 bg-teal-500/5 shadow-inner"
              : "border-slate-800 hover:border-slate-700 bg-[#0f172a]/20"
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center">
            {uploading ? (
              <div className="space-y-3">
                <Loader2 className="w-10 h-10 text-teal-400 animate-spin mx-auto" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">Extracting text & indexing vectors...</p>
                  <p className="text-xs text-slate-500 mt-1">This takes a few seconds to run chunking and hybrid TF-IDF schemas.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-lg shadow-black/10 group-hover:scale-105 transition-all">
                  <UploadCloud className="w-6 h-6 text-teal-500" />
                </div>
                <h3 className="text-sm font-semibold text-slate-200">Ingest Document</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Drag and drop a PDF here, or click to browse. Max size 50MB.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Documents Table List Card */}
        <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-slate-800/80 bg-[#0f172a]/40 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Ingested Session Documents</h3>
            <span className="text-[10px] font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
              SQLite Schema
            </span>
          </div>

          <div className="divide-y divide-slate-800/60">
            {loading && docs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
                Loading documents...
              </div>
            ) : docs.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-sm font-medium">No documents uploaded yet</p>
                <p className="text-xs text-slate-600 mt-1">Ingest a PDF above to initialize the vector index.</p>
              </div>
            ) : (
              docs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/30 transition-all ${
                    selectedDocId === doc.id ? "bg-teal-500/5 border-l-2 border-teal-500" : ""
                  }`}
                >
                  <div className="flex items-center gap-3.5 truncate max-w-[80%]">
                    <div className="w-8.5 h-8.5 rounded-lg bg-teal-500/5 border border-teal-500/15 flex items-center justify-center text-teal-400 shrink-0">
                      <FileText className="w-4.5 h-4.5" />
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-semibold text-slate-200 truncate">{doc.filename}</p>
                      <div className="flex items-center gap-2.5 text-[10px] text-slate-500 font-medium mt-0.5">
                        <span>{doc.page_count} Pages</span>
                        <span>•</span>
                        <span>{doc.chunk_count} Chunks</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedDocId(doc.id)}
                      className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer"
                      title="View Summary"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(doc.id, e)}
                      className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Info Details Panel Card (Span 1) */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl h-full flex flex-col min-h-[400px]">
        <div className="p-5 border-b border-slate-800/80 bg-[#0f172a]/40 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-400" />
          <h3 className="text-sm font-semibold text-slate-200">Intelligence Summary</h3>
        </div>

        <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
          {selectedDoc ? (
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Filename</h4>
                <p className="text-sm font-semibold text-slate-200 truncate">{selectedDoc.filename}</p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Auto-Generated Summary
                </h4>
                <div className="p-4 rounded-xl bg-[#030712]/50 border border-slate-800/60 text-slate-300 text-xs leading-relaxed italic">
                  {parsedSummary ? (
                    parsedSummary.summary
                  ) : (
                    <span className="text-slate-500 italic">No summary cached for this document.</span>
                  )}
                </div>
              </div>

              {parsedSummary?.mindmap?.keywords && parsedSummary.mindmap.keywords.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Key Concepts</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedSummary.mindmap.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-semibold text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-full border border-teal-500/20"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-500">
              <Sparkles className="w-8 h-8 text-slate-700 mb-3 animate-pulse" />
              <p className="text-xs font-semibold text-slate-400">Select a document</p>
              <p className="text-[11px] text-slate-600 mt-1 max-w-[180px] mx-auto leading-relaxed">
                Click on any document in the list to load its intelligence metrics and summary cards.
              </p>
            </div>
          )}

          {selectedDoc && (
            <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-600" />
                Indexed
              </span>
              <span>{new Date(selectedDoc.created_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

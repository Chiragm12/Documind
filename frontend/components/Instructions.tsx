// frontend/components/Instructions.tsx
"use client";
import React from "react";
import { MessageSquare, FileText, Network, Sparkles } from "lucide-react";

type Props = { section: "chat" | "documents" | "mindmap" };

export default function Instructions({ section }: Props) {
  if (section === "chat") {
    return (
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-[#0f172a]/20 shadow-xl flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-200">Interactive Chat Workspace</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Query your ingested documents using hybrid neural retrieval. Type any question, and the assistant will synthesize a response, cite matching document sources, and compute relevance scores.
          </p>
        </div>
      </div>
    );
  }

  if (section === "documents") {
    return (
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-[#0f172a]/20 shadow-xl flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-200">Document Corpus Management</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Upload PDFs to index them in the workspace. The ingestion pipeline runs page-based text extraction, splits content into overlap chunks, indexes them in a local vector database, and generates summary metadata.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-[#0f172a]/20 shadow-xl flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
        <Network className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-slate-200">Interactive Conceptual Network Map</h4>
        <p className="text-xs text-slate-400 leading-relaxed">
          Explore key topics dynamically. The workspace consolidates keywords generated for all ingested PDFs into a unified force-directed concept graph. Drag nodes to reshape the physics model, scroll to zoom.
        </p>
      </div>
    </div>
  );
}

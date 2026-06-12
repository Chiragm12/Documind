// frontend/components/ChatWindow.tsx
"use client";
import React, { useState, useRef, useEffect } from "react";
import { Send, FileText, Bot, User, Trash2, ArrowUpRight, Cpu } from "lucide-react";
import { streamChat } from "../lib/api";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  streaming?: boolean;
};

type Source = {
  filename: string;
  page: number;
  text_preview: string;
  ce_score: number;
};

// Simple custom renderer for basic markdown structures (bold, code, lists)
// keeping the component zero-dependency and high-fidelity
function formatMessageContent(content: string) {
  if (!content) return null;
  
  const lines = content.split("\n");
  return lines.map((line, idx) => {
    let rendered = line;
    
    // Bold formatting: **text**
    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = boldRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }
      parts.push(<strong key={match.index} className="text-teal-300 font-bold">{match[1]}</strong>);
      lastIndex = boldRegex.lastIndex;
    }
    
    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }
    
    // Code formatting: `code`
    const finalParts = parts.map((part, pIdx) => {
      if (typeof part !== "string") return part;
      
      const codeRegex = /`(.*?)`/g;
      const codeSubParts = [];
      let cLastIndex = 0;
      let cMatch;
      
      while ((cMatch = codeRegex.exec(part)) !== null) {
        if (cMatch.index > cLastIndex) {
          codeSubParts.push(part.substring(cLastIndex, cMatch.index));
        }
        codeSubParts.push(
          <code key={cMatch.index} className="bg-[#030712]/50 border border-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-cyan-400">
            {cMatch[1]}
          </code>
        );
        cLastIndex = codeRegex.lastIndex;
      }
      
      if (cLastIndex < part.length) {
        codeSubParts.push(part.substring(cLastIndex));
      }
      
      return codeSubParts.length > 0 ? <React.Fragment key={pIdx}>{codeSubParts}</React.Fragment> : part;
    });

    // Check if list item
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      return (
        <ul key={idx} className="list-disc pl-5 my-1 text-slate-300">
          <li>{finalParts.length > 0 ? finalParts : line.trim().slice(2)}</li>
        </ul>
      );
    }
    if (line.trim().startsWith("> ")) {
      return (
        <blockquote key={idx} className="border-l-2 border-teal-500/50 pl-3 italic text-slate-400 my-1 bg-[#1e293b]/20 py-0.5">
          {finalParts.length > 0 ? finalParts : line.trim().slice(2)}
        </blockquote>
      );
    }

    return (
      <p key={idx} className="min-h-[1.2em] leading-relaxed my-1">
        {finalParts.length > 0 ? finalParts : line}
      </p>
    );
  });
}

export default function ChatWindow({ sessionId, docIds }: { sessionId: string; docIds: string[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Clear messages when session changes
    setMessages([]);
    setInput("");
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    setLoading(true);

    // Add user message
    setMessages(prev => [...prev, { role: "user", content: question }]);
    // Add empty assistant message placeholder for streaming
    setMessages(prev => [...prev, { role: "assistant", content: "", streaming: true }]);

    try {
      const reader = await streamChat(question, sessionId, docIds);
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.token) {
              setMessages(prev =>
                prev.map((m, i) =>
                  i === prev.length - 1
                    ? { ...m, content: m.content + parsed.token }
                    : m
                )
              );
            }
            if (parsed.done && parsed.sources) {
              setMessages(prev =>
                prev.map((m, i) =>
                  i === prev.length - 1
                    ? { ...m, sources: parsed.sources, streaming: false }
                    : m
                )
              );
            }
          } catch (err) {
            // parsing error, ignore partial/malformed JSON chunks
          }
        }
      }
    } catch (e) {
      console.error(e);
      setMessages(prev =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, content: m.content + "\n\n*Connection error, failed to stream response.*", streaming: false }
            : m
        )
      );
    } finally {
      setLoading(false);
      setMessages(prev =>
        prev.map((m, i) => i === prev.length - 1 ? { ...m, streaming: false } : m)
      );
    }
  }

  async function handleClearHistory() {
    if (messages.length === 0 || loading) return;
    if (!confirm("Clear this session's conversation history?")) return;
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      await fetch(`${API_BASE}/chat/memory/${sessionId}`, { method: "DELETE" });
      setMessages([]);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0b0f19]">
      {/* Chat Sub-Header */}
      <div className="px-6 py-3 border-b border-slate-800 flex justify-between items-center bg-[#0f172a]/40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-teal-400" />
          <span className="text-xs font-semibold text-slate-300">RAG Conversation Memory</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 font-medium transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Chat
          </button>
        )}
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-12 h-12 bg-slate-800/40 rounded-xl flex items-center justify-center text-teal-400 mb-4 border border-slate-800">
              <Bot className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-200">How can I assist you today?</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Ask questions about your ingested PDFs. The assistant uses semantic vector search + keyword search to find relevant information.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {/* Bot Avatar */}
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0 shadow-lg shadow-teal-500/5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              {/* Message Content Bubble */}
              <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm shadow-xl transition-all ${
                msg.role === "user"
                  ? "bg-[#115e59] text-white border border-[#14b8a6]/20"
                  : "bg-[#0f172a] text-slate-200 border border-slate-800/60"
              }`}>
                {/* Bubble Text */}
                <div className="space-y-1.5">
                  {formatMessageContent(msg.content)}
                  {msg.streaming && (
                    <span className="inline-block w-1.5 h-4 bg-teal-400 animate-pulse ml-1 align-middle" />
                  )}
                </div>

                {/* Citations Box */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-3.5 border-t border-slate-800 space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <Cpu className="w-3.5 h-3.5 text-teal-500" />
                      Semantic Hybrid Search Citations
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2">
                      {msg.sources.map((src, j) => (
                        <div
                          key={j}
                          className="p-3 rounded-lg bg-[#070b13]/55 border border-slate-800/80 hover:border-teal-500/20 transition-all text-xs"
                        >
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mb-1.5">
                            <span className="flex items-center gap-1 truncate text-slate-300 max-w-[80%]" title={src.filename}>
                              <FileText className="w-3 h-3 text-teal-500 shrink-0" />
                              {src.filename}
                            </span>
                            <span className="shrink-0 text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">
                              Page {src.page}
                            </span>
                          </div>
                          <p className="text-slate-400 line-clamp-3 text-[11px] leading-relaxed italic bg-[#0b0f19]/40 p-1.5 rounded border border-slate-800/20">
                            "{src.text_preview}..."
                          </p>
                          <div className="flex items-center justify-between text-[9px] text-slate-500 mt-2 font-mono">
                            <span>Score Weight</span>
                            <span>{src.ce_score.toFixed(4)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* User Avatar */}
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-teal-600 border border-teal-500/30 flex items-center justify-center text-white shrink-0 shadow-lg shadow-teal-600/5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Form Box */}
      <div className="border-t border-slate-800 p-4 bg-[#0c101b]">
        <div className="relative flex items-center">
          <input
            className="w-full bg-[#030712]/50 text-slate-100 rounded-xl border border-slate-800 px-5 pr-14 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder-slate-500"
            placeholder="Ask anything about the active document workspace..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="absolute right-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 disabled:opacity-40 transition-colors flex items-center gap-1 shadow-lg shadow-teal-600/10 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
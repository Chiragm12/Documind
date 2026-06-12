// frontend/components/MindMap.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Network, ZoomIn, ZoomOut, RefreshCw } from "lucide-react";

type MindMapNode = {
  id: string;
  label: string;
  type: "root" | "document" | "keyword";
  details?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
};

type MindMapLink = {
  source: string | MindMapNode;
  target: string | MindMapNode;
};

type Props = {
  sessionId: string;
  documents: any[];
};

export default function MindMap({ sessionId, documents }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomBehavior, setZoomBehavior] = useState<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Construct hierarchy from documents
  const nodes: MindMapNode[] = [];
  const links: MindMapLink[] = [];

  // Create root node
  nodes.push({
    id: "root",
    label: "Session Map",
    type: "root",
    details: "Universal hub combining all documents uploaded to this workspace."
  });

  // Populate document and keyword nodes
  documents.forEach((doc) => {
    // Add document node linked to root
    nodes.push({
      id: doc.id,
      label: doc.filename,
      type: "document",
      details: `${doc.page_count} pages • ${doc.chunk_count} chunks`
    });
    links.push({ source: "root", target: doc.id });

    // Parse summary JSON to extract keywords
    let keywords: string[] = [];
    if (doc.summary) {
      try {
        const parsed = JSON.parse(doc.summary);
        keywords = parsed?.mindmap?.keywords || [];
      } catch (e) {
        // Fallback if summary is text rather than JSON
      }
    }

    // Add keyword nodes linked to parent document
    keywords.forEach((kw) => {
      const kwId = `${doc.id}-${kw}`;
      nodes.push({
        id: kwId,
        label: kw,
        type: "keyword"
      });
      links.push({ source: doc.id, target: kwId });
    });
  });

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length <= 1) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 500;

    const svg = d3.select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", "100%");

    svg.selectAll("*").remove();

    // Setup visual container group
    const g = svg.append("g");

    // Configure zoom behaviors
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);
    setZoomBehavior(() => zoom);

    // Physics force simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance((d: any) => {
        // root links are longer, keywords closer to documents
        return d.source.type === "root" ? 140 : 60;
      }))
      .force("charge", d3.forceManyBody().strength((d: any) => {
        return d.type === "root" ? -600 : d.type === "document" ? -300 : -80;
      }))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => {
        return d.type === "root" ? 60 : d.type === "document" ? 45 : 30;
      }));

    // Links lines styling
    const link = g.append("g")
      .attr("stroke", "#1e293b")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d: any) => (d.source.type === "root" ? 2 : 1))
      .attr("stroke-dasharray", (d: any) => (d.source.type === "root" ? "none" : "3,3"));

    // Tooltip overlay styling
    const tooltip = d3.select(containerRef.current)
      .append("div")
      .attr("class", "absolute hidden bg-[#0f172a] border border-slate-800 p-2.5 rounded-lg text-[10px] text-slate-300 pointer-events-none max-w-[200px] leading-relaxed shadow-xl");

    // Nodes group
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag<SVGGElement, any>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Node circles decoration
    node.append("circle")
      .attr("r", (d) => (d.type === "root" ? 24 : d.type === "document" ? 14 : 7))
      .attr("fill", (d) => {
        if (d.type === "root") return "#14b8a6"; // vibrant teal for root
        if (d.type === "document") return "#0f766e"; // darker teal for doc
        return "#1e293b"; // dark slate for keyword
      })
      .attr("stroke", (d) => {
        if (d.type === "root") return "#0d9488";
        if (d.type === "document") return "#0d9488";
        return "#14b8a6"; // cyan border for keyword
      })
      .attr("stroke-width", (d) => (d.type === "keyword" ? 1.5 : 2.5))
      .attr("class", "cursor-grab active:cursor-grabbing hover:scale-110 transition-transform duration-200");

    // Node text labels
    node.append("text")
      .attr("dy", (d) => (d.type === "root" ? ".35em" : d.type === "document" ? "1.9em" : "1.7em"))
      .attr("text-anchor", "middle")
      .attr("fill", (d) => (d.type === "root" ? "#fff" : d.type === "document" ? "#e2e8f0" : "#94a3b8"))
      .attr("font-size", (d) => (d.type === "root" ? "10px" : d.type === "document" ? "9px" : "8px"))
      .attr("font-weight", (d) => (d.type === "keyword" ? "normal" : "bold"))
      .text((d) => {
        if (d.type === "root") return d.label;
        return d.label.length > 18 ? d.label.slice(0, 16) + "..." : d.label;
      });

    // Tooltip trigger events
    node.on("mouseover", (event, d) => {
      if (!d.details && d.type === "keyword") return;
      tooltip.style("display", "block")
        .html(`
          <div class="font-bold text-teal-400 mb-0.5">${d.label}</div>
          <div class="text-slate-400 font-sans">${d.details || "Keyword concept."}</div>
        `);
    })
    .on("mousemove", (event) => {
      // Offset tooltip slightly from mouse
      const x = event.layerX + 15;
      const y = event.layerY + 15;
      tooltip.style("left", `${x}px`).style("top", `${y}px`);
    })
    .on("mouseout", () => {
      tooltip.style("display", "none");
    });

    // Tick simulation callback
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [sessionId, documents, nodes.length, links.length]);

  function handleZoomIn() {
    if (!zoomBehavior || !svgRef.current) return;
    d3.select(svgRef.current).transition().call(zoomBehavior.scaleBy as any, 1.3);
  }

  function handleZoomOut() {
    if (!zoomBehavior || !svgRef.current) return;
    d3.select(svgRef.current).transition().call(zoomBehavior.scaleBy as any, 0.7);
  }

  function handleReset() {
    if (!zoomBehavior || !svgRef.current) return;
    d3.select(svgRef.current).transition().call(zoomBehavior.transform as any, d3.zoomIdentity);
  }

  if (documents.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
        <Network className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
        <p className="text-sm font-semibold text-slate-400">Map is empty</p>
        <p className="text-xs text-slate-600 mt-1 max-w-[240px] leading-relaxed">
          Ingest a document first. The concept network will construct automatically from the document keywords.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* Zoom Control Overlay HUD */}
      <div className="absolute bottom-4 right-4 flex gap-1 bg-[#0f172a]/80 backdrop-blur border border-slate-800 p-1.5 rounded-lg shadow-xl z-10">
        <button
          onClick={handleZoomIn}
          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleReset}
          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
          title="Reset Zoom"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
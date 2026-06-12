"use client";
import React from "react";

export default function SourceCard({ source }: { source: { filename: string; page: number; text_preview: string } }) {
	return (
		<div style={{border:'1px solid #eef2f7',padding:8,borderRadius:6,background:'#fafafa'}}>
			<div style={{fontSize:12,fontWeight:600}}>{source.filename} — page {source.page}</div>
			<div style={{fontSize:12,color:'#475569',marginTop:6}}>{source.text_preview}</div>
		</div>
	);
}

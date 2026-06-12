// frontend/app/session/[id]/page.tsx
"use client";
import React from "react";
import Home from "../../page";

type PageProps = {
  params: {
    id: string;
  };
};

export default function SessionPage({ params }: PageProps) {
  return <Home sessionId={params.id} />;
}

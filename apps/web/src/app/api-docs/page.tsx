"use client";

import SwaggerUI from "swagger-ui-react";

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="mb-4 text-3xl font-semibold">Lattice API docs</h1>
        <SwaggerUI url="/api/openapi" docExpansion="list" />
      </div>
    </main>
  );
}

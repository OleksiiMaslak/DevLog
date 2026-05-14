"use client";

import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas p-8 text-ink">
      <AlertTriangle size={36} className="text-berry" />
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted">The application encountered an unexpected error.</p>
      <button
        className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:brightness-110"
        onClick={reset}
      >
        Try again
      </button>
    </main>
  );
}

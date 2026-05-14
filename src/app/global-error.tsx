"use client";

import { AlertTriangle } from "lucide-react";

// Catches errors thrown inside the root layout (layout.tsx) and root page.
// error.tsx cannot catch those — only global-error.tsx can.
// Must include its own <html> and <body> tags since the root layout is unavailable.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
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
      </body>
    </html>
  );
}

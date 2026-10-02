"use client";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0b0f17", color: "#e5e7eb", fontFamily: "system-ui, sans-serif" }}>
        <main role="alert" style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Helix couldn&apos;t start</h1>
          <p style={{ fontSize: 14, color: "#9ca3af", margin: "0 0 16px" }}>Nothing on your desk was changed. Reload to try again.</p>
          {error.digest ? <p style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>Reference: {error.digest}</p> : null}
          <button type="button" onClick={() => retry()} style={{ minHeight: 40, padding: "0 16px", borderRadius: 8, border: 0, background: "#c9a24b", color: "#0b0f17", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

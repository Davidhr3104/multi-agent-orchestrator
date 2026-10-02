export function downloadCsv(filename: string, rows: Record<string, string | number | boolean | null | undefined>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const body = [headers.join(","), ...rows.map((row) => headers.map((key) => esc(row[key])).join(","))].join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function printReport(title: string, lines: string[]) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
  if (!popup) return;
  const body = lines.map((line) => `<p>${line.replace(/</g, "&lt;")}</p>`).join("");
  popup.document.write(`<!doctype html><html><head><title>${title}</title><style>body{font-family:Georgia,serif;color:#111;margin:48px;background:#fff}h1{font-size:28px;margin-bottom:4px}p{line-height:1.5}</style></head><body><p>Helix for Inbox · Executive brief</p><h1>${title}</h1>${body}<script>window.print()<\\/script></body></html>`);
  popup.document.close();
}

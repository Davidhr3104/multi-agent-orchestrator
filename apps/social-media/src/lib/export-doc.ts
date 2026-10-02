import { channelLabel, PILLAR_LABEL, STATUS_LABEL } from "./format";
import type { ScoredPost } from "./store";

export type ExportRow = {
  id: string;
  scheduledFor: string;
  channel: string;
  pillar: string;
  status: string;
  score: number;
  caption: string;
  hashtags: string;
  approvedBy: string;
};

export function toExportRows(posts: ScoredPost[]): ExportRow[] {
  return posts.map((p) => ({
    id: p.id,
    scheduledFor: p.scheduledFor,
    channel: channelLabel(p.channel),
    pillar: PILLAR_LABEL[p.pillar],
    status: STATUS_LABEL[p.status],
    score: p.readiness.score,
    caption: p.caption,
    hashtags: p.hashtags.map((t) => `#${t}`).join(" "),
    approvedBy: p.approvedBy ?? "",
  }));
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: ExportRow[]): string {
  const header = ["scheduledFor", "channel", "pillar", "status", "score", "caption", "hashtags", "approvedBy", "id"];
  const lines = rows.map((r) => header.map((key) => csvCell(r[key as keyof ExportRow])).join(","));
  return `\uFEFF${header.join(",")}\n${lines.join("\n")}\n`;
}

function pdfEscape(text: string): string {
  const ascii = text.replace(/[^\x20-\x7E]/g, "?");
  return ascii.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width) {
      if (line) lines.push(line);
      line = word.slice(0, width);
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** A small text PDF. Enough for a monthly grid export, not a designed report. */
export function toPdf(title: string, rows: ExportRow[]): Uint8Array {
  const lines = [title, "Approval state is a sign-off on this desk. Nothing here was published.", ""];
  if (rows.length === 0) lines.push("No posts match this export.");
  for (const row of rows) {
    lines.push(...wrap(`${row.scheduledFor.slice(0, 16)}  ${row.channel}  ${row.pillar}  ${row.status}  ${row.score}/100`, 92));
    lines.push(...wrap(row.caption, 92));
    if (row.hashtags) lines.push(...wrap(row.hashtags, 92));
    lines.push("");
  }
  return pdfFromLines(lines);
}

export function pdfFromLines(lines: string[]): Uint8Array {
  const title = lines[0] ?? "Helix";
  const pageSize = 46;
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += pageSize) chunks.push(lines.slice(i, i + pageSize));
  if (chunks.length === 0) chunks.push([title]);

  const fontId = 3 + chunks.length * 2;
  const objects: string[] = [];
  const pageIds: number[] = [];
  for (let page = 0; page < chunks.length; page += 1) {
    const contentId = 3 + page * 2;
    const pageId = contentId + 1;
    const commands = ["BT", "/F1 10 Tf", "48 750 Td", "14 TL"];
    chunks[page].forEach((line, index) => {
      if (index === 0) commands.push(`(${pdfEscape(line)}) Tj`);
      else commands.push(`(${pdfEscape(line)}) '`);
    });
    commands.push("ET");
    const stream = commands.join("\n");
    pageIds.push(pageId);
    objects.push(`${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>\nendobj\n`
    );
  }
  const kids = pageIds.map((id) => `${id} 0 R`).join(" ");
  const catalog = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  const pages = `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageIds.length} >>\nendobj\n`;
  const font = `${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  const body = catalog + pages + objects.join("") + font;

  let offset = "%PDF-1.4\n".length;
  const offsets = [0];
  const all = [catalog, pages, ...objects, font];
  for (const obj of all) {
    offsets.push(offset);
    offset += obj.length;
  }
  const xrefStart = "%PDF-1.4\n".length + body.length;
  let xref = `xref\n0 ${fontId + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= fontId; i += 1) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(`%PDF-1.4\n${body}${xref}${trailer}`);
}

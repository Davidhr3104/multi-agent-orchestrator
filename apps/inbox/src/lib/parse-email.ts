export type ParsedEmail = {
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function unfoldHeaders(raw: string): string {
  return raw.replace(/\r\n[ \t]+/g, " ").replace(/\n[ \t]+/g, " ");
}

function parseFrom(value: string): { name: string; email: string } {
  const angle = value.match(/^(.*?)<([^>]+)>/);
  if (angle) {
    const email = angle[2].trim();
    const name = angle[1].replace(/^"|"$/g, "").trim() || email.split("@")[0] || "Unknown";
    return { name, email };
  }
  const email = value.match(EMAIL_RE)?.[0] ?? "";
  const name = email ? value.replace(email, "").replace(/[<>]/g, "").trim() : value.trim();
  return { name: name || email.split("@")[0] || "Unknown", email };
}

function header(block: string, name: string): string {
  const re = new RegExp(`^${name}:\\s*(.*)$`, "im");
  return block.match(re)?.[1]?.trim() ?? "";
}

export function parseUploadedEmail(text: string): ParsedEmail {
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const split = raw.search(/\n\n/);
  const hasHeaders = /^(From|Subject|To|Date|Return-Path|Received):/im.test(raw);

  if (hasHeaders && split >= 0) {
    const head = unfoldHeaders(raw.slice(0, split));
    const body = raw.slice(split + 2).trim();
    const from = parseFrom(header(head, "From"));
    return {
      fromName: from.name,
      fromEmail: from.email,
      subject: header(head, "Subject") || "(no subject)",
      body: body || raw.trim(),
    };
  }

  const firstLine = raw.split("\n").find((l) => l.trim())?.trim() ?? "";
  return {
    fromName: "",
    fromEmail: "",
    subject: firstLine.slice(0, 120) || "(no subject)",
    body: raw.trim(),
  };
}

export function isEmailUpload(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".txt") || name.endsWith(".eml") || file.type.startsWith("text/");
}

import { createHash, timingSafeEqual } from "node:crypto";

export const OPERATOR_COOKIE = "helix_operator";

export type HelixProductLink = {
  name: string;
  href: string;
  className: string;
};

export function operatorKeyConfigured(): boolean {
  return Boolean(process.env.HELIX_OPERATOR_KEY?.trim());
}

export function operatorToken(key: string): string {
  return createHash("sha256").update(`helix-ops:${key}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyOperatorKey(input: string): boolean {
  const key = process.env.HELIX_OPERATOR_KEY?.trim();
  if (!key || !input) return false;
  return safeEqual(input, key);
}

export function operatorCookieMatches(cookieValue: string | undefined): boolean {
  const key = process.env.HELIX_OPERATOR_KEY?.trim();
  if (!key || !cookieValue) return false;
  return safeEqual(cookieValue, operatorToken(key));
}

export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return rest.join("=");
  }
  return undefined;
}

export function operatorProductLinks(): HelixProductLink[] {
  const leads = process.env.HELIX_LEADS_URL?.trim() || "http://localhost:43148";
  const legal = process.env.HELIX_LEGAL_URL?.trim() || "http://localhost:43149";
  const inbox = process.env.HELIX_INBOX_URL?.trim() || "http://localhost:43151";
  const commerce = process.env.HELIX_COMMERCE_URL?.trim() || "http://localhost:43150";
  return [
    { name: "Helix for Leads", href: leads, className: "text-cyan-400" },
    { name: "Helix for Legal", href: legal, className: "text-amber-300" },
    { name: "Helix for Inbox", href: inbox, className: "text-blue-400" },
    { name: "Helix for Commerce", href: commerce, className: "text-emerald-400" },
    { name: "Helix for Video", href: "#", className: "text-red-400/50" },
    { name: "Helix for Social", href: "#", className: "text-pink-400/50" },
    { name: "Helix for Edit", href: "#", className: "text-violet-400/50" },
  ];
}

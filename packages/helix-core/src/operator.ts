import { createHash, timingSafeEqual } from "node:crypto";
import { getSecret } from "./secrets";
import { looksLikeActionToken } from "./action-token";

export const OPERATOR_COOKIE = "helix_operator";

export type HelixProductLink = {
  name: string;
  href: string;
  className: string;
};

function operatorKey(): string {
  return getSecret("HELIX_OPERATOR_KEY");
}

export function operatorKeyConfigured(): boolean {
  return Boolean(operatorKey());
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
  const key = operatorKey();
  if (!key || !input) return false;
  return safeEqual(input, key);
}

export function operatorCookieMatches(cookieValue: string | undefined): boolean {
  const key = operatorKey();
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

export function slackOpsQuery(): string {
  const key = operatorKey();
  if (!key) return "";
  return `ops=${operatorToken(key)}`;
}

/**
 * Who acted: local (no key), operator (cookie/header), or slack (`ops=`).
 * When the operator key is unset, local HITL stays open.
 * When set, require cookie, raw key header, or Slack `ops` query.
 */
export function operatorActor(req: Request): string {
  const t = new URL(req.url).searchParams.get("t")?.trim() || "";
  if (t && looksLikeActionToken(t)) return "slack";
  if (!operatorKey()) return "local";
  const ops = new URL(req.url).searchParams.get("ops")?.trim() || "";
  if (ops && safeEqual(ops, operatorToken(operatorKey()))) return "slack";
  return "operator";
}

/**
 * `?t=<signed action token>` is let through here on shape alone (it has the
 * "<payload>.<sig>" form) — the real HMAC/expiry verification happens in the
 * route handler via verifyActionToken(), which also needs the token's own
 * orgId/leadId, not just a pass/fail. This function only decides whether the
 * request gets past the operator-key gate at all.
 */
export function requireOperator(req: Request): Response | null {
  const t = new URL(req.url).searchParams.get("t")?.trim() || "";
  if (t && looksLikeActionToken(t)) return null;

  const key = operatorKey();
  if (!key) return null;

  const cookie = readCookie(req.headers.get("cookie"), OPERATOR_COOKIE);
  if (operatorCookieMatches(cookie)) return null;

  const headerKey = req.headers.get("x-helix-operator-key")?.trim() || "";
  if (headerKey && verifyOperatorKey(headerKey)) return null;

  const ops = new URL(req.url).searchParams.get("ops")?.trim() || "";
  if (ops && safeEqual(ops, operatorToken(key))) return null;

  return Response.json({ error: "Operator unlock required." }, { status: 401 });
}

export function operatorProductLinks(): HelixProductLink[] {
  const leads = process.env.HELIX_LEADS_URL?.trim() || "http://localhost:43148";
  const legal = process.env.HELIX_LEGAL_URL?.trim() || "http://localhost:43149";
  const inbox = process.env.HELIX_INBOX_URL?.trim() || "http://localhost:43151";
  const commerce = process.env.HELIX_COMMERCE_URL?.trim() || "http://localhost:43150";
  const marketing = process.env.HELIX_MARKETING_URL?.trim() || "http://localhost:43152";
  return [
    { name: "Helix for Leads", href: leads, className: "text-cyan-400" },
    { name: "Helix for Legal", href: legal, className: "text-amber-300" },
    { name: "Helix for Inbox", href: inbox, className: "text-blue-400" },
    { name: "Helix for Commerce", href: commerce, className: "text-emerald-400" },
    { name: "Helix for Marketing", href: marketing, className: "text-orange-400" },
    { name: "Helix for Video", href: "#", className: "text-red-400/50" },
    { name: "Helix for Social", href: "#", className: "text-pink-400/50" },
    { name: "Helix for Edit", href: "#", className: "text-violet-400/50" },
  ];
}

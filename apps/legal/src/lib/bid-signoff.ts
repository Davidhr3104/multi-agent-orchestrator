export type BidSignOffAction = "approve" | "reject" | "override";
export type BidCall = "GO" | "NO-GO";

export type BidSignOff = {
  rfpId: string;
  action: BidSignOffAction;
  bid: BidCall;
  at: string;
  actor: string;
};

export const SIGNOFF_COOKIE = "helix_legal_signoff_v1";

export function resolveBidCall(
  aiVerdict: "GO" | "CONDITIONAL" | "NO-GO",
  action: BidSignOffAction
): BidCall {
  if (action === "approve") return "GO";
  if (action === "reject") return "NO-GO";
  return aiVerdict === "GO" ? "NO-GO" : "GO";
}

export function signOffLabel(action: BidSignOffAction): string {
  if (action === "approve") return "Approve bid";
  if (action === "reject") return "Reject / no-bid";
  return "Override AI";
}

type CookieState = { v: 1; signOffs: Record<string, BidSignOff> };

function emptyState(): CookieState {
  return { v: 1, signOffs: {} };
}

function readCookieHeader(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return rest.join("=");
  }
  return undefined;
}

export function readSignOffCookie(req: Request): Record<string, BidSignOff> {
  const raw = readCookieHeader(req.headers.get("cookie"), SIGNOFF_COOKIE);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as CookieState;
    if (parsed?.v !== 1 || !parsed.signOffs || typeof parsed.signOffs !== "object") return {};
    return parsed.signOffs;
  } catch {
    return {};
  }
}

export function signOffCookieHeader(signOffs: Record<string, BidSignOff>): string {
  const value = encodeURIComponent(JSON.stringify({ v: 1, signOffs } satisfies CookieState));
  return `${SIGNOFF_COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax; HttpOnly`;
}

export function applySignOffToRfp<T extends { id: string; needsReview: boolean }>(
  rfp: T,
  signOffs: Record<string, BidSignOff>
): T {
  if (!signOffs[rfp.id]) return rfp;
  return { ...rfp, needsReview: false };
}

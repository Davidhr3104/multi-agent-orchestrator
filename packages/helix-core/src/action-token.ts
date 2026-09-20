import { createHmac, timingSafeEqual } from "node:crypto";
import { getSecret } from "./secrets";

export type LeadAction = "review" | "archive" | "crm";

export type ActionTokenPayload = {
  orgId: string;
  leadId: string;
  action: LeadAction;
  /** Unix ms timestamp — after this the token is rejected. */
  exp: number;
};

function signingKey(): string {
  // Reuses the existing operator secret rather than adding new config
  // surface — same trust boundary as the rest of the operator-actions system.
  return getSecret("HELIX_OPERATOR_KEY");
}

export function actionTokenConfigured(): boolean {
  return Boolean(signingKey());
}

function base64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64url(input: string): string | null {
  try {
    return Buffer.from(input, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function hmac(payloadB64: string, key: string): string {
  return createHmac("sha256", key).update(payloadB64).digest("hex");
}

export function signActionToken(payload: ActionTokenPayload): string {
  const key = signingKey();
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = hmac(payloadB64, key);
  return `${payloadB64}.${sig}`;
}

export type VerifyResult =
  | { ok: true; payload: ActionTokenPayload }
  | { ok: false; reason: "unconfigured" | "malformed" | "tampered" | "expired" };

export function verifyActionToken(token: string): VerifyResult {
  const key = signingKey();
  if (!key) return { ok: false, reason: "unconfigured" };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadB64, sig] = parts;

  const expectedSig = hmac(payloadB64, key);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "tampered" };
  }

  const json = fromBase64url(payloadB64);
  if (!json) return { ok: false, reason: "malformed" };
  let payload: ActionTokenPayload;
  try {
    payload = JSON.parse(json) as ActionTokenPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    typeof payload.orgId !== "string" ||
    typeof payload.leadId !== "string" ||
    typeof payload.exp !== "number" ||
    (payload.action !== "review" && payload.action !== "archive" && payload.action !== "crm")
  ) {
    return { ok: false, reason: "malformed" };
  }
  if (Date.now() > payload.exp) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload };
}

/** Looks like a signed action token (has the "<payload>.<sig>" shape) — used to let it past requireOperator without doing the real crypto check there. */
export function looksLikeActionToken(value: string): boolean {
  return value.includes(".") && value.split(".").length === 2;
}

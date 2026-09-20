import { cookies } from "next/headers";
import {
  OPERATOR_COOKIE,
  operatorCookieMatches,
  operatorKeyConfigured,
  operatorProductLinks,
  operatorToken,
  verifyOperatorKey,
  type HelixProductLink,
} from "@helix/core/operator";

export async function operatorSession(): Promise<{
  operator: boolean;
  configured: boolean;
  products: HelixProductLink[];
}> {
  const configured = operatorKeyConfigured();
  const jar = await cookies();
  const token = jar.get(OPERATOR_COOKIE)?.value;
  const operator = configured && operatorCookieMatches(token);
  return {
    operator,
    configured,
    products: operator ? operatorProductLinks() : [],
  };
}

export function unlockOperator(key: string): { ok: boolean; token?: string } {
  if (!verifyOperatorKey(key)) return { ok: false };
  return { ok: true, token: operatorToken(key.trim()) };
}

export function operatorCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${OPERATOR_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

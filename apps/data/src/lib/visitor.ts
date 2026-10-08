export const VISITOR_COOKIE = "helix_data_visitor";

export function newVisitorId(): string {
  return `v-${crypto.randomUUID()}`;
}

export function visitorFromRequest(req: Request): { id: string; setCookie: boolean } {
  const raw = req.headers.get("cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|;\\s*)${VISITOR_COOKIE}=([^;]+)`));
  const existing = match?.[1]?.trim();
  if (existing) return { id: existing, setCookie: false };
  return { id: newVisitorId(), setCookie: true };
}

export function cookieHeader(id: string): string {
  return `${VISITOR_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
}

export function withVisitorCookie(req: Request, res: Response): Response {
  const v = visitorFromRequest(req);
  if (!v.setCookie) return res;
  const headers = new Headers(res.headers);
  headers.append("Set-Cookie", cookieHeader(v.id));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

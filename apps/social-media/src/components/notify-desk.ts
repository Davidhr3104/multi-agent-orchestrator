"use client";

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export function notifyDesk(message: string, ids: string[] = []) {
  window.dispatchEvent(new CustomEvent("helix:ai-action", { detail: { message, ids } }));
  window.dispatchEvent(new CustomEvent("helix:desk-refresh"));
}

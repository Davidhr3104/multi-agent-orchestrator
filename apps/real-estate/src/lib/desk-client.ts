type ExecuteBody = { action: string; targetIds: string[]; labels?: string[]; params?: Record<string, unknown> };
type Result = { resultText?: string; done?: string[]; failed?: { id: string; error: string }[]; undo?: unknown[]; error?: string };

/**
 * Runs a desk action for a person's click (the click is the confirmation), then tells the page to refresh
 * and toast. Throws with the server's reason when nothing changed.
 */
export async function runDeskAction(input: ExecuteBody): Promise<string> {
  const res = await fetch("/api/ask-ai/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => null)) as Result | null;
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  if (!body?.done?.length) throw new Error(body?.failed?.[0]?.error ?? "Nothing changed.");
  const message = body.resultText ?? "Done.";
  window.dispatchEvent(new CustomEvent("helix:ai-action", { detail: { message, ids: input.targetIds, undo: body.undo } }));
  window.dispatchEvent(new CustomEvent("helix:desk-refresh"));
  return message;
}

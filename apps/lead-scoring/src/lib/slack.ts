import { getSecret } from "@helix/core";
import { slackOpsQuery } from "@helix/core/operator";
import { actionTokenConfigured, signActionToken, type LeadAction } from "@helix/core/action-token";

export function isSlackConfigured(): boolean {
  return Boolean(getSecret("SLACK_WEBHOOK_URL"));
}

const ACTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Per-action link query string. Prefers a signed, expiring, org+lead-scoped
 * token (`t=`) — falls back to the static, non-expiring `ops=` bearer token
 * when orgId is unavailable (legacy single-tenant mode) or no signing key is
 * configured, so the buttons never end up link-less (never fail silently).
 */
function actionQuery(orgId: string | undefined, leadId: string, action: LeadAction): string {
  if (orgId && actionTokenConfigured()) {
    const t = signActionToken({ orgId, leadId, action, exp: Date.now() + ACTION_TTL_MS });
    return `?t=${t}`;
  }
  const ops = slackOpsQuery();
  return ops ? `?${ops}` : "";
}

export async function notifySlackHitl(
  input: { id: string; name: string; score: number; reason: string },
  orgId: string | undefined
): Promise<boolean> {
  const url = getSecret("SLACK_WEBHOOK_URL");
  if (!url) return false;
  const base = process.env.HELIX_PUBLIC_URL || "http://localhost:43148";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `HITL · ${input.name} (score ${input.score}). ${input.reason}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Nuevo lead:* ${input.name} · score ${input.score}\n${input.reason}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Aprobar" },
              url: `${base}/api/leads/${input.id}/review${actionQuery(orgId, input.id, "review")}`,
              style: "primary",
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Enviar a CRM" },
              url: `${base}/api/leads/${input.id}/crm${actionQuery(orgId, input.id, "crm")}`,
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Archivar" },
              url: `${base}/api/leads/${input.id}/archive${actionQuery(orgId, input.id, "archive")}`,
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}

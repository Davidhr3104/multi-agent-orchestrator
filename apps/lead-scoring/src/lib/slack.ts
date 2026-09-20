import { getSecret } from "@helix/core";
import { slackOpsQuery } from "@helix/core/operator";

export function isSlackConfigured(): boolean {
  return Boolean(getSecret("SLACK_WEBHOOK_URL"));
}

export async function notifySlackHitl(input: {
  id: string;
  name: string;
  score: number;
  reason: string;
}): Promise<boolean> {
  const url = getSecret("SLACK_WEBHOOK_URL");
  if (!url) return false;
  const base = process.env.HELIX_PUBLIC_URL || "http://localhost:43148";
  const ops = slackOpsQuery();
  const q = ops ? `?${ops}` : "";
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
              url: `${base}/api/leads/${input.id}/review${q}`,
              style: "primary",
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Archivar" },
              url: `${base}/api/leads/${input.id}/archive${q}`,
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}

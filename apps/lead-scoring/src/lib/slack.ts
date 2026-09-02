export function isSlackConfigured(): boolean {
  return Boolean(process.env.SLACK_WEBHOOK_URL);
}

export async function notifySlackHitl(input: {
  id: string;
  name: string;
  score: number;
  reason: string;
}): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL;
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
              url: `${base}/api/leads/${input.id}/review`,
              style: "primary",
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Archivar" },
              url: `${base}/api/leads/${input.id}/archive`,
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}

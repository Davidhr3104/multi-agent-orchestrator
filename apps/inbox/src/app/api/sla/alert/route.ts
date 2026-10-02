import { getSecret } from "@helix/core";
import { isSlackConfigured } from "@/lib/slack";

export const runtime = "nodejs";

function publicHttps(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname;
    if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0") return false;
    if (/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function allowedWebhook(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return (
      parsed.hostname === "hooks.slack.com" ||
      parsed.hostname.endsWith(".webhook.office.com") ||
      parsed.hostname === "outlook.office.com"
    );
  } catch {
    return false;
  }
}

async function post(url: string, text: string, allow: (url: string) => boolean = allowedWebhook) {
  if (!allow(url)) return false;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const row = body as { subject?: string; remainingMin?: number };
  const subject = String(row.subject || "Urgent thread").slice(0, 180);
  const remaining = Math.max(0, Math.round(Number(row.remainingMin) || 0));
  const text = `SLA warning: “${subject}” is ${remaining} min from breach.`;
  const slackUrl = getSecret("SLACK_WEBHOOK_URL");
  const teamsUrl = getSecret("TEAMS_WEBHOOK_URL");
  const slack = slackUrl ? await post(slackUrl, text) : false;
  const teams = teamsUrl ? await post(teamsUrl, text) : false;
  const b2bUrl = getSecret("B2B_WEBHOOK_URL");
  const b2b = b2bUrl ? await post(b2bUrl, text, publicHttps) : false;
  const sid = getSecret("TWILIO_ACCOUNT_SID");
  const twilioToken = getSecret("TWILIO_AUTH_TOKEN");
  const from = getSecret("TWILIO_FROM");
  const to = getSecret("TWILIO_TO");
  let sms = false;
  if (sid && twilioToken && from && to) {
    const body = new URLSearchParams({ From: from, To: to, Body: text });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${twilioToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null);
    sms = Boolean(res?.ok);
  }
  return Response.json({ ok: true, slack: slack || isSlackConfigured(), teams, sms, b2b, notified: slack || teams || sms || b2b });
}

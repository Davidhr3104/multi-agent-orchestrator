import { getSecret } from "@helix/core";
import { getPreferences, listAllThreads } from "@/lib/store";
import { sendTwilioMessage } from "@/lib/twilio";
import type { RunDeps } from "./runner";

type SendResult = { ok: true } | { ok: false; error: string };

/** Only Slack's own webhook host: the URL is operator-set, but a typo or a poisoned value must not become an open relay. */
export function isSlackWebhook(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "hooks.slack.com";
  } catch {
    return false;
  }
}

export async function sendSlackText(text: string): Promise<SendResult> {
  const url = getSecret("SLACK_WEBHOOK_URL");
  if (!url) return { ok: false, error: "Slack is not connected (no webhook saved)." };
  if (!isSlackWebhook(url)) return { ok: false, error: "The saved Slack webhook is not a hooks.slack.com URL, so nothing was sent." };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok ? { ok: true } : { ok: false, error: `Slack answered HTTP ${res.status}.` };
  } catch (err) {
    return { ok: false, error: `Could not reach Slack (${err instanceof Error ? err.message : "network error"}).` };
  }
}

export async function sendTwilioText(input: { to: string; body: string; channel: "sms" | "whatsapp" }): Promise<SendResult> {
  const r = await sendTwilioMessage(input);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** The real dependencies for a run on this server. */
export async function realDeps(): Promise<RunDeps> {
  const prefs = await getPreferences();
  return {
    now: () => new Date(),
    threads: () => listAllThreads(),
    vipSenders: prefs.vipSenders,
    sendSlack: sendSlackText,
    sendTwilio: sendTwilioText,
  };
}

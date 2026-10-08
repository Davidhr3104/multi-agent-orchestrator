import { isE164, runKey, type AutomationRun, type AutomationSpec, type Channel } from "@helix/core/automations";
import type { EmailThread } from "@/lib/types";
import { buildSourceText } from "./digest";

/**
 * Executes one automation. It never throws: every outcome, including a sender that blew up, becomes an
 * AutomationRun with the exact text and the reason, so a failure is visible in the history and never silent.
 * Senders are injected so the policy (consent, recipient, preview) is tested without a network.
 */

type SendResult = { ok: true } | { ok: false; error: string };

export type RunDeps = {
  now: () => Date;
  threads: () => Promise<EmailThread[]>;
  vipSenders: string[];
  sendSlack: (text: string) => Promise<SendResult>;
  sendTwilio: (input: { to: string; body: string; channel: "sms" | "whatsapp" }) => Promise<SendResult>;
};

export type RunRequest =
  | { trigger: "schedule"; scheduledFor: string; preview?: boolean }
  | { trigger: "manual"; preview: boolean; scheduledFor?: undefined };

let counter = 0;
function runId(now: Date): string {
  counter += 1;
  return `run-${now.getTime().toString(36)}-${counter.toString(36)}`;
}

export async function runAutomation(spec: AutomationSpec, req: RunRequest, deps: RunDeps): Promise<AutomationRun> {
  const startedAt = deps.now();
  const preview = Boolean(req.preview);
  const scheduledFor = req.trigger === "schedule" ? req.scheduledFor : null;
  const base = {
    id: runId(startedAt),
    automationId: spec.id,
    key: scheduledFor ? runKey(spec.id, scheduledFor) : `${spec.id}@manual:${startedAt.toISOString()}`,
    scheduledFor,
    startedAt: startedAt.toISOString(),
    trigger: req.trigger,
    preview,
  } as const;
  const finish = (r: Pick<AutomationRun, "status"> & Partial<AutomationRun>): AutomationRun => ({
    ...base,
    finishedAt: deps.now().toISOString(),
    ...r,
  });

  try {
    const threads = await deps.threads();
    const parts: string[] = [];
    for (const step of spec.steps) {
      if (step.type === "source") parts.push(buildSourceText(step.node, threads, { now: startedAt.getTime(), vipSenders: deps.vipSenders }).text);
    }
    const text = parts.join("\n\n");
    if (!text) return finish({ status: "failed", error: "The automation produced no content." });

    if (preview) return finish({ status: "ok", text, delivered: [] });

    // Sending for real is only allowed for something the person confirmed: that is their consent to the sends.
    if (!spec.confirmedAt) return finish({ status: "failed", text, error: "Not confirmed: the person never approved this automation, so nothing was sent." });

    const delivered: Channel[] = [];
    const failures: string[] = [];
    for (const step of spec.steps) {
      if (step.type !== "send") continue;
      let result: SendResult;
      try {
        if (step.channel === "in_app") result = { ok: true };
        else if (step.channel === "slack") result = await deps.sendSlack(text);
        else if (step.channel === "whatsapp" || step.channel === "sms") {
          result = isE164(step.to)
            ? await deps.sendTwilio({ to: step.to as string, body: text, channel: step.channel })
            : { ok: false, error: "no valid recipient number (E.164, e.g. +5215512345678)" };
        } else result = { ok: false, error: `channel "${step.channel}" is not available in Inbox yet` };
      } catch (err) {
        result = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
      if (result.ok) delivered.push(step.channel);
      else failures.push(`${step.channel}: ${result.error}`);
    }
    if (failures.length) return finish({ status: "failed", text, delivered, error: failures.join("; ") });
    return finish({ status: "ok", text, delivered });
  } catch (err) {
    return finish({ status: "failed", error: err instanceof Error ? err.message : String(err) });
  }
}

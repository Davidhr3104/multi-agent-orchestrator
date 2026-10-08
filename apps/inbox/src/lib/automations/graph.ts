import { isE164, isValidTimeZone, type AutomationRun, type AutomationSpec, type Channel, type ChannelInfo } from "@helix/core/automations";
import { CHANNEL_LABEL, SOURCES } from "./catalog";
import { clock12 } from "./service";

/**
 * Turns an automation into the nodes and edges the canvas draws. Everything on a card is a fact about the
 * routine or about this desk (what is connected, what is missing, how the last run went); nothing is decorative.
 */

export type IconKey = "clock" | "inbox" | "slack" | "phone" | "app" | "history";

export type GraphNode = {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  iconKey: IconKey;
  tone?: "warn" | "bad" | "ok";
  chips?: { label: string; tone?: "ok" | "bad" | "warn" | "muted" }[];
  action: { label: string; href: string } | null;
};

export type Graph = { nodes: GraphNode[]; edges: { from: string; to: string }[] };

const CHANNEL_ICON: Record<Channel, IconKey> = { in_app: "app", slack: "slack", whatsapp: "phone", sms: "phone", email: "inbox" };

const FAIL_GOES_TO_HISTORY = "Fail → History";

function lastRunChip(run?: AutomationRun): { label: string; tone: "ok" | "bad" | "warn" | "muted" } {
  if (!run) return { label: "No runs yet", tone: "muted" };
  if (run.status === "failed") return { label: "Last run: failed", tone: "bad" };
  if (run.status === "expired") return { label: "Last run: missed", tone: "warn" };
  if (run.status === "skipped") return { label: "Last run: skipped", tone: "warn" };
  return { label: run.preview ? "Last run: preview" : "Last run: sent", tone: "ok" };
}

export function specToGraph(spec: AutomationSpec, channels: Partial<Record<Channel, ChannelInfo>>, lastRun?: AutomationRun): Graph {
  const nodes: GraphNode[] = [];

  if (spec.trigger.kind === "daily") {
    const tzOk = isValidTimeZone(spec.trigger.tz);
    nodes.push({
      id: "trigger",
      kind: "Trigger",
      title: `Every day at ${clock12(spec.trigger.time)}`,
      subtitle: tzOk ? spec.trigger.tz : "No time zone saved yet",
      iconKey: "clock",
      tone: tzOk ? undefined : "warn",
      chips: tzOk ? undefined : [{ label: "Time zone missing", tone: "warn" }],
      action: tzOk ? null : { label: "Set it", href: "#settings" },
    });
  } else {
    nodes.push({ id: "trigger", kind: "Trigger", title: "Run on demand", subtitle: "Starts when you press Preview or Send now", iconKey: "clock", action: null });
  }

  spec.steps.forEach((step, i) => {
    const id = `step-${i}`;
    if (step.type === "source") {
      const def = SOURCES[step.node];
      nodes.push({
        id,
        kind: "Data",
        title: def?.label ?? step.node,
        subtitle: def?.description ?? "Unknown source",
        iconKey: "inbox",
        tone: def ? undefined : "bad",
        chips: [{ label: "On success", tone: "ok" }, { label: FAIL_GOES_TO_HISTORY, tone: "bad" }],
        action: null,
      });
      return;
    }
    const info = channels[step.channel];
    const connected = Boolean(info?.connected);
    const needsNumber = Boolean(info?.needsRecipient) && !isE164(step.to);
    const subtitle = step.to
      ? `To ${step.to}`
      : needsNumber
        ? "Needs your number"
        : step.channel === "slack"
          ? "Posts to your Slack webhook"
          : step.channel === "in_app"
            ? "Shows in History on this page"
            : "Sends from this desk";
    nodes.push({
      id,
      kind: "Send",
      title: CHANNEL_LABEL[step.channel],
      subtitle,
      iconKey: CHANNEL_ICON[step.channel],
      tone: !connected || needsNumber ? "warn" : undefined,
      chips: [connected ? { label: "Connected", tone: "ok" } : { label: "Not connected", tone: "warn" }, ...(needsNumber ? [{ label: "Number missing", tone: "warn" as const }] : [])],
      action: !connected && info ? { label: "Connect", href: info.connectUrl } : null,
    });
  });

  nodes.push({
    id: "record",
    kind: "History",
    title: "Record the run",
    subtitle: "Every outcome, with the exact text, and the reason if it failed",
    iconKey: "history",
    chips: [lastRunChip(lastRun)],
    action: null,
  });

  const edges = nodes.slice(0, -1).map((n, i) => ({ from: n.id, to: nodes[i + 1].id }));
  return { nodes, edges };
}

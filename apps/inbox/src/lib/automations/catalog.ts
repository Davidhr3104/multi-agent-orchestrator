import type { Channel, ChannelInfo, NodeDef, ValidationContext } from "@helix/core/automations";

/**
 * The closed catalog of what an Inbox automation can use. Nothing outside this file can be a step, which is
 * what keeps user-built flows honest: every source is a real function over this desk's data, every channel
 * is a connector that exists in this app.
 */

export type SourceDef = NodeDef & {
  description: string;
  /** Exactly what the message will contain, in words the person can check. Shown in the chat reply. */
  includes: string[];
};

export const SOURCES: Record<string, SourceDef> = {
  "inbox.daily_digest": {
    kind: "source",
    label: "Daily inbox digest",
    description: "What arrived in the last 24 hours and what still needs you.",
    includes: ["threads received in the last 24 hours", "threads waiting for your review", "SLA breaches", "spam blocked", "the top threads that need you"],
  },
  "inbox.sla_breaches": {
    kind: "source",
    label: "SLA breaches",
    description: "Open threads that are past their reply target right now.",
    includes: ["how many threads are past their SLA target", "the worst offenders and how late they are"],
  },
};

export const DEFAULT_SOURCE = "inbox.daily_digest";

export type DeskConnections = {
  slack: boolean;
  /** Twilio credentials are present. That is not proof Twilio accepts them: only a real send says that. */
  twilio: boolean;
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  in_app: "In-app (Helix)",
  slack: "Slack",
  whatsapp: "WhatsApp (Twilio)",
  sms: "SMS (Twilio)",
  email: "Email",
};

export function channelInfos(conn: DeskConnections): Partial<Record<Channel, ChannelInfo>> {
  return {
    in_app: { tool: "helix", label: CHANNEL_LABEL.in_app, connected: true, connectUrl: "/automations", needsRecipient: false },
    slack: { tool: "slack", label: CHANNEL_LABEL.slack, connected: conn.slack, connectUrl: "/settings", needsRecipient: false },
    whatsapp: { tool: "twilio", label: CHANNEL_LABEL.whatsapp, connected: conn.twilio, connectUrl: "/settings", needsRecipient: true },
    sms: { tool: "twilio", label: CHANNEL_LABEL.sms, connected: conn.twilio, connectUrl: "/settings", needsRecipient: true },
  };
}

export function validationContext(conn: DeskConnections, timezone: string | null): ValidationContext {
  return {
    nodes: SOURCES,
    channels: channelInfos(conn),
    settings: { timezone },
    settingsUrl: "/automations#settings",
  };
}

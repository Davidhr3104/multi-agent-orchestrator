import { isE164, isValidTimeZone, parseClock, type AutomationSpec, type Channel } from "@helix/core/automations";
import { deskWriteDenied } from "@/lib/ai-desk";
import { SOURCES, validationContext } from "@/lib/automations/catalog";
import { builtinAutomations } from "@/lib/automations/builtins";
import { buildSpec } from "@/lib/automations/parse";
import { runAutomation } from "@/lib/automations/runner";
import { realDeps } from "@/lib/automations/senders";
import {
  chatReply,
  confirmAutomation,
  createAutomation,
  recordRun,
  removeAutomation,
  revalidateAll,
  setPaused,
  setRecipient,
  setTimezone,
  type AutomationState,
} from "@/lib/automations/service";
import { automationAccess, cronConfigured, deskConnections, withAutomationCookie } from "@/lib/automations/storage";
import { supabaseListEmailAccounts } from "@/lib/supabase-desk";
import { DEFAULT_WORKSPACE_ID } from "@/lib/types";

export const runtime = "nodejs";

const CHANNELS: Channel[] = ["in_app", "slack", "whatsapp", "sms"];

async function snapshot(state: AutomationState, access: ReturnType<typeof automationAccess>) {
  const conn = deskConnections();
  const accounts = await supabaseListEmailAccounts(DEFAULT_WORKSPACE_ID);
  const gmailConnected = accounts.some((a) => a.isConnected && a.accessToken);
  return {
    mode: access.mode,
    limit: access.limit,
    timezone: state.timezone,
    automations: state.automations,
    runs: state.runs,
    sources: Object.entries(SOURCES).map(([id, s]) => ({ id, label: s.label, description: s.description, includes: s.includes })),
    connections: { slack: conn.slack, twilio: conn.twilio, gmail: gmailConnected },
    cronConfigured: cronConfigured(),
    builtins: builtinAutomations(conn, { gmailConnected, cronSecret: cronConfigured() }),
  };
}

/** Re-derives every status from what is connected right now (e.g. after the person connected Slack). */
async function loadFresh(access: ReturnType<typeof automationAccess>): Promise<AutomationState> {
  const state = await access.load();
  const ctx = validationContext(deskConnections(), state.timezone);
  const fresh = revalidateAll(state, ctx, new Date());
  const changed = JSON.stringify(fresh.automations.map((a) => [a.id, a.status, a.missing])) !== JSON.stringify(state.automations.map((a) => [a.id, a.status, a.missing]));
  if (changed) await access.save(fresh);
  return fresh;
}

export async function GET(req: Request) {
  const access = automationAccess(req);
  try {
    const state = await loadFresh(access);
    return withAutomationCookie(Response.json(await snapshot(state, access)), access);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Could not load automations" }, { status: 500 });
  }
}

type Body = {
  action?: string;
  id?: string;
  source?: string;
  channel?: string;
  time?: string;
  to?: string;
  timezone?: string;
  preview?: boolean;
  confirm?: boolean;
};

function newId(): string {
  return `auto-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  const access = automationAccess(req);
  const now = new Date();
  try {
    let state = await loadFresh(access);
    const ctx = () => validationContext(deskConnections(), state.timezone);
    let reply: string | undefined;
    let run: unknown;

    switch (body.action) {
      case "create": {
        if (!body.source || !SOURCES[body.source]) return Response.json({ error: "Unknown source." }, { status: 400 });
        if (!body.channel || !CHANNELS.includes(body.channel as Channel)) return Response.json({ error: "Unknown channel." }, { status: 400 });
        if (!body.time || !parseClock(body.time)) return Response.json({ error: "Time must be HH:MM (24h)." }, { status: 400 });
        if (body.to && !isE164(body.to)) return Response.json({ error: "Phone must be in international format, e.g. +5215512345678." }, { status: 400 });
        const spec = buildSpec(
          { source: body.source, channel: body.channel as Channel, channelWasDefault: false, time: body.time, to: body.to },
          { tz: state.timezone, now, id: newId() }
        );
        const created = createAutomation(state, { ...spec, createdBy: "canvas" }, ctx(), { confirm: Boolean(body.confirm), now, limit: access.limit });
        state = created.state;
        reply = chatReply(created.spec, created.validation);
        break;
      }
      case "confirm":
        state = confirmAutomation(state, need(body.id), ctx(), now);
        break;
      case "pause":
      case "resume":
        state = setPaused(state, need(body.id), body.action === "pause", ctx(), now);
        break;
      case "delete":
        state = removeAutomation(state, need(body.id));
        break;
      case "timezone":
        if (!body.timezone || !isValidTimeZone(body.timezone)) return Response.json({ error: "That is not a valid time zone." }, { status: 400 });
        state = setTimezone(state, body.timezone, ctx(), now);
        break;
      case "recipient":
        state = setRecipient(state, need(body.id), body.to ?? "", ctx(), now);
        break;
      case "run": {
        const spec = state.automations.find((a) => a.id === need(body.id)) as AutomationSpec | undefined;
        if (!spec) return Response.json({ error: "Automation not found." }, { status: 404 });
        // The demo desk never sends anything, and a live "preview" never does either.
        const preview = access.mode === "demo" || body.preview !== false;
        const result = await runAutomation(spec, { trigger: "manual", preview }, await realDeps());
        state = recordRun(state, result);
        run = result;
        break;
      }
      default:
        return Response.json({ error: "Unknown action." }, { status: 400 });
    }

    await access.save(state);
    return withAutomationCookie(Response.json({ ...(await snapshot(state, access)), reply, run }), access);
  } catch (err) {
    // Business-rule failures (limit reached, bad phone, unknown id) are the person's to read, not a server fault.
    return Response.json({ error: err instanceof Error ? err.message : "Automation change failed" }, { status: 400 });
  }
}

function need(id: string | undefined): string {
  if (!id) throw new Error("An automation id is required.");
  return id;
}

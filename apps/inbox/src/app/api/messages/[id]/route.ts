import {
  getMessage,
  listThreadMessages,
  patchMessage,
  regenerateSmartReply,
  snoozeThread,
  applyDeskPatches,
} from "@/lib/store";
import { queryInboxKb } from "@/lib/kb-store";
import {
  jsonWithDeskCookie,
  patchFromThread,
  readDeskCookie,
  upsertDeskPatch,
} from "@/lib/desk-state-cookie";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { sendThreadReply } from "@/lib/reply-send";
import { sendToLeadsDesk } from "@/lib/leads-handoff";
import { getAgentProfile, setAgentProfile } from "@/lib/agent-profile";
import { getSecret } from "@helix/core";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const state = readDeskCookie(req);
  applyDeskPatches(state.patches);
  const message = await getMessage(id);
  if (!message) return Response.json({ error: "Not found" }, { status: 404 });
  const patched = state.patches[id] ? { ...message, ...state.patches[id] } : message;
  const history = await listThreadMessages(id);
  // I2: recompute kbHits on every read instead of trusting whatever was set
  // at ingest time — the ingest-time value lives only in the in-memory
  // thread object and does not survive a Supabase-backed cold start/restart,
  // so citations would silently vanish. Recomputing here is cheap (KB is a
  // small, cached, in-process corpus) and makes the drawer's citations
  // durable across restarts without a second migration/column.
  const kbHits = queryInboxKb({ subject: patched.subject, body: patched.body });
  return Response.json({ message: { ...patched, kbHits }, history });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const payload = body as {
    action?: string;
    until?: string;
    draftReply?: string;
    isStarred?: boolean;
    isRead?: boolean;
    provider?: string;
    token?: string;
    links?: string[];
  };

  let state = readDeskCookie(req);
  applyDeskPatches(state.patches);

  try {
    if (payload.action === "approve" || payload.action === "send") {
      const result = await sendThreadReply(id, operatorActor(req), { human: true });
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      state = upsertDeskPatch(state, id, patchFromThread(result.message));
      return jsonWithDeskCookie({ message: result.message, sentId: result.sentId, sentVia: result.sentVia }, state);
    }
    if (payload.action === "handoff_leads") {
      const current = await getMessage(id);
      if (!current) return Response.json({ error: "Not found" }, { status: 404 });
      const result = await sendToLeadsDesk(current);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: 502 });
      }
      const message = await patchMessage(
        id,
        { routeTo: "Helix for Leads", handedOffAt: new Date().toISOString() },
        { actionType: `handoff_leads:${operatorActor(req)}`, humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message, leadId: result.leadId }, state);
    }
    if (payload.action === "route") {
      const message = await patchMessage(
        id,
        { status: "routed", needsReview: false, isRead: true },
        { actionType: `route:${operatorActor(req)}`, humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "block") {
      const message = await patchMessage(
        id,
        {
          status: "blocked",
          needsReview: false,
          routeTo: "Spam",
          category: "spam",
          isRead: true,
        },
        { actionType: `block:${operatorActor(req)}`, humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "unblock") {
      const message = await patchMessage(
        id,
        {
          status: "open",
          needsReview: true,
          category: "action_required",
          routeTo: "Sales · Deveku",
        },
        { actionType: "unblock", humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "snooze") {
      const message = await snoozeThread(id, payload.until);
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "smart_reply") {
      const message = await regenerateSmartReply(id);
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "star") {
      const current = await getMessage(id);
      if (!current) return Response.json({ error: "Not found" }, { status: 404 });
      const message = await patchMessage(
        id,
        { isStarred: !current.isStarred },
        { actionType: "star", humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "read") {
      const message = await patchMessage(
        id,
        { isRead: true },
        { actionType: "read", humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "meeting") {
      const zoom = payload.provider === "zoom";
      const url = zoom ? "https://zoom.us/start/videomeeting" : "https://meet.google.com/new";
      const current = await getMessage(id);
      if (!current) return Response.json({ error: "Not found" }, { status: 404 });
      const line = zoom ? `Zoom meeting: ${url}` : `Google Meet: ${url}`;
      const message = await patchMessage(
        id,
        { draftReply: `${current.draftReply}\n\n${line}`.trim(), needsReview: true },
        { actionType: `meeting:${zoom ? "zoom" : "meet"}`, humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "crm") {
      const current = await getMessage(id);
      if (!current) return Response.json({ error: "Not found" }, { status: 404 });
      const token = getSecret("HUBSPOT_TOKEN") || String(payload.token || "");
      if (!token) {
        return Response.json({ error: "Add a HubSpot token in Integrations or HUBSPOT_TOKEN." }, { status: 400 });
      }
      const created = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          properties: {
            dealname: `${current.fromName} — ${current.subject}`.slice(0, 180),
            description: current.snippet || current.body.slice(0, 500),
          },
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!created.ok) {
        const detail = await created.text();
        return Response.json({ error: `HubSpot ${created.status}: ${detail.slice(0, 180)}` }, { status: 502 });
      }
      const deal = (await created.json()) as { id?: string };
      const message = await patchMessage(
        id,
        { reasoning: `${current.reasoning} · HubSpot deal ${deal.id ?? "created"}` },
        { actionType: `crm_hubspot:${operatorActor(req)}`, humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message, dealId: deal.id }, state);
    }
    if (payload.action === "attach_kb") {
      const current = await getMessage(id);
      if (!current) return Response.json({ error: "Not found" }, { status: 404 });
      const hits = queryInboxKb({ subject: current.subject, body: current.body }, 3);
      const links = (payload.links ?? [])
        .filter((url) => typeof url === "string" && /^https:\/\/\S{8,300}$/.test(url))
        .slice(0, 2);
      if (!hits.length && !links.length) return Response.json({ error: "No company source matched this thread." }, { status: 404 });
      const block = hits.map((hit) => `- ${hit.docTitle}: ${hit.quote || hit.excerpt}`).join("\n");
      const linkBlock = links.length ? `\nOfficial links:\n${links.map((url) => `- ${url}`).join("\n")}` : "";
      const message = await patchMessage(
        id,
        { draftReply: `${current.draftReply}\n\nFrom our files:\n${block}${linkBlock}`.trim(), kbHits: hits, needsReview: true },
        { actionType: "attach_kb", humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "save_style") {
      const current = await getMessage(id);
      if (!current?.draftReply) return Response.json({ error: "Nothing to learn from yet." }, { status: 400 });
      const prev = getAgentProfile();
      setAgentProfile({ prompt: `${prev.prompt}\nMatch this reply style:\n${current.draftReply.slice(0, 600)}`.trim() });
      const message = await patchMessage(
        id,
        {},
        { actionType: `save_style:${operatorActor(req)}`, humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      return jsonWithDeskCookie({ message, profile: getAgentProfile() }, state);
    }
    if (payload.action === "feedback") {
      const message = await patchMessage(
        id,
        { needsReview: true },
        { actionType: `classification_feedback:${operatorActor(req)}`, humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.draftReply != null) {
      const message = await patchMessage(
        id,
        { draftReply: String(payload.draftReply) },
        { actionType: "edit_draft", humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

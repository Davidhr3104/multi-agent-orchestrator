import { demoAvailable, type DeskMode } from "@helix/core";
import { can, type AccessAction } from "./access";
import { autoFixDraft } from "./autofix";
import { composeDraft, knowledgeLines, parseCompose } from "./compose";
import { applyRewrite, repurposeDraft, type RewriteAction } from "./copilot";
import { PLANS } from "./plans";
import { hardBlockers, scoreReadiness } from "./readiness";
import { suggestSlot } from "./schedule";
import { buildHarborPosts, buildSeedPosts, DEMO_BRAND, HARBOR_BRAND } from "./seed";
import { STOCK, stockById } from "./stock";
import type { AccessRole, ApprovalMode, Brand, Channel, Comment, DeskRole, ExecutiveReport, LibraryAsset, MediaItem, Member, PlanId, Post, PostStatus, Readiness, Revision, WebhookDelivery, WebhookEndpoint } from "./types";

/**
 * In-memory desks, one per workspace. Approving a post records a sign-off here and nothing is published.
 * HELIX_DESK_SEED=off starts an empty live workspace. A second sample brand exists only in demo mode.
 */
type Workspace = {
  id: string;
  posts: Map<string, Post>;
  brand: Brand;
  approval: ApprovalMode;
  creditsUsed: number;
  assets: LibraryAsset[];
  members: Member[];
  webhooks: WebhookEndpoint[];
  outbox: WebhookDelivery[];
  reports: ExecutiveReport[];
  reviewToken?: string;
  autopilot?: boolean;
};

type Root = {
  seeded: boolean;
  activeId: string;
  sessionRole: AccessRole;
  plan: PlanId;
  workspaces: Map<string, Workspace>;
};

const EMPTY_BRAND: Brand = { name: "Your brand", handle: "", voice: [], avoid: [], directives: "", channels: [] };

function root(): Root {
  const g = globalThis as typeof globalThis & { __helixSocialDesk?: Root };
  g.__helixSocialDesk ??= { seeded: false, activeId: "brand", sessionRole: "owner", plan: "starter", workspaces: new Map() };
  return g.__helixSocialDesk;
}

type StoredPost = Post & { comments: Comment[]; revisions: Revision[]; media: MediaItem[] };

const clone = (p: Post): StoredPost => ({
  ...p,
  hashtags: [...p.hashtags],
  notes: [...(p.notes ?? [])],
  comments: (p.comments ?? []).map((c) => ({ ...c })),
  revisions: (p.revisions ?? []).map((r) => ({ ...r })),
  media: (p.media ?? []).map((m) => ({ ...m })),
});

function nid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function copyBrand(brand: Brand): Brand {
  return { ...brand, voice: [...brand.voice], avoid: [...brand.avoid], channels: [...brand.channels], directives: brand.directives ?? "" };
}

function lumenWorkspace(): Workspace {
  return {
    id: "lumen",
    posts: new Map(buildSeedPosts().map((post) => [post.id, post])),
    brand: copyBrand(DEMO_BRAND),
    approval: "manager",
    creditsUsed: 0,
    assets: STOCK.slice(0, 4).map((frame) => ({
      id: `lib-${frame.id}`,
      name: frame.label,
      kind: "image" as const,
      url: frame.url,
      folder: "Product",
      tags: [frame.pillar],
      approved: frame.pillar === "product",
    })),
    members: [
      { id: "you", name: "You", role: "owner" },
      { id: "marta", name: "Marta", role: "manager" },
      { id: "priya", name: "Priya", role: "creator" },
      { id: "jonah", name: "Jonah", role: "client" },
    ],
    webhooks: [],
    outbox: [],
    reports: [],
  };
}

function harborWorkspace(): Workspace {
  return {
    id: "harbor",
    posts: new Map(buildHarborPosts().map((post) => [post.id, post])),
    brand: copyBrand(HARBOR_BRAND),
    approval: "manager_then_client",
    creditsUsed: 0,
    assets: [
      {
        id: "lib-harbor-linen",
        name: "Linen stack",
        kind: "image",
        url: "https://images.unsplash.com/photo-1616628188506-4f8e0e4d90c8?auto=format&fit=crop&w=900&q=70",
        folder: "Product",
        tags: ["linen"],
        approved: true,
      },
    ],
    members: [
      { id: "you", name: "You", role: "owner" },
      { id: "lena", name: "Lena", role: "creator" },
    ],
    webhooks: [],
    outbox: [],
    reports: [],
  };
}

function emptyWorkspace(id: string, brand: Brand): Workspace {
  return { id, posts: new Map(), brand: copyBrand(brand), approval: "manager", creditsUsed: 0, assets: [], members: [{ id: "you", name: "You", role: "owner" }], webhooks: [], outbox: [], reports: [] };
}

function applyDemo() {
  const r = root();
  r.workspaces = new Map([
    ["lumen", lumenWorkspace()],
    ["harbor", harborWorkspace()],
  ]);
  r.activeId = "lumen";
  r.sessionRole = "owner";
  r.plan = "starter";
  r.seeded = true;
}

function ensure(): Workspace {
  const r = root();
  if (!r.seeded) {
    if (demoAvailable()) applyDemo();
    else {
      r.workspaces.set("brand", emptyWorkspace("brand", EMPTY_BRAND));
      r.activeId = "brand";
      r.seeded = true;
    }
  }
  const ws = r.workspaces.get(r.activeId);
  if (!ws) throw new Error("Active workspace is missing");
  if (typeof ws.brand.directives !== "string") ws.brand.directives = "";
  return ws;
}

export class AccessError extends Error {}

function requireAccess(action: AccessAction) {
  const role = root().sessionRole;
  if (!can(role, action)) throw new AccessError(`The ${role} role can't do that.`);
}

function spendCredit(ws: Workspace) {
  const limit = PLANS[root().plan].credits;
  if (ws.creditsUsed >= limit) throw new DraftError(`This workspace has used its ${limit} AI credits on the ${PLANS[root().plan].label} plan.`);
  ws.creditsUsed += 1;
}

function record(ws: Workspace, event: string, payload: Record<string, unknown>) {
  ws.outbox.unshift({ id: nid("wh"), at: new Date().toISOString(), event, payload });
  ws.outbox = ws.outbox.slice(0, 30);
}

export type ScoredPost = Post & { readiness: Readiness };

export function currentDeskMode(): DeskMode {
  return demoAvailable() ? "demo" : "live";
}

export async function getBrand(): Promise<Brand> {
  return ensure().brand;
}

function scored(p: Post, brand: Brand): ScoredPost {
  return { ...clone(p), readiness: scoreReadiness(p, brand) };
}

export async function listPosts(): Promise<ScoredPost[]> {
  const d = ensure();
  return [...d.posts.values()].map((p) => scored(p, d.brand)).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

export async function getPost(id: string): Promise<ScoredPost | null> {
  const d = ensure();
  const p = d.posts.get(id);
  return p ? scored(p, d.brand) : null;
}

/** Raw copy for Undo snapshots. */
export async function getPostRaw(id: string): Promise<Post | null> {
  const p = ensure().posts.get(id);
  return p ? clone(p) : null;
}

export async function putPost(p: Post): Promise<void> {
  ensure().posts.set(p.id, clone(p));
}

const NOTE_MAX = 400;

export class ReviewError extends Error {}

function finalize(next: StoredPost, actor: string, clean?: string) {
  next.status = "approved";
  next.approvedBy = actor;
  next.approvedAt = new Date().toISOString();
  if (clean) next.notes.push(`${actor}: ${clean}`);
}

/** A person's (or Helix AI's, once confirmed) review decision. Throws ReviewError when the move isn't allowed. */
export async function reviewPost(id: string, decision: "approve" | "changes" | "submit", actor: string, note?: string): Promise<ScoredPost | null> {
  const d = ensure();
  const p = d.posts.get(id);
  if (!p) return null;
  const role = root().sessionRole;
  const next = clone(p);
  const clean = note?.trim().slice(0, NOTE_MAX);
  if (decision === "approve") {
    if (role === "creator") throw new AccessError("Creators draft. A manager or the client approves.");
    if (p.status === "approved") throw new ReviewError("This post is already approved.");
    const readiness = scoreReadiness(p, d.brand);
    if (hardBlockers(readiness.factors).length) throw new ReviewError(`Can't approve yet. ${readiness.summary}`);
    const needsClient = d.approval === "manager_then_client";
    if (needsClient && !p.internalSignOff) {
      if (role === "client") throw new ReviewError("Internal review has to sign off before the client.");
      next.internalSignOff = { by: actor, at: new Date().toISOString() };
      next.notes.push(`${actor}: Internal sign-off. Waiting for the client.`);
      if (clean) next.notes.push(`${actor}: ${clean}`);
      d.posts.set(id, next);
      record(d, "post.internal_signoff", { id, actor });
      return scored(next, d.brand);
    }
    if (needsClient && role === "manager") throw new ReviewError("This workspace waits for the client after internal sign-off.");
    if (!needsClient && role === "client") throw new AccessError("Clients comment here. A manager approves.");
    finalize(next, actor, clean);
    record(d, "post.approved", { id, actor });
  } else if (decision === "changes") {
    if (!clean) throw new ReviewError("Say what needs to change.");
    next.status = "changes";
    delete next.approvedBy;
    delete next.approvedAt;
    delete next.internalSignOff;
    next.notes.push(`${actor}: ${clean}`);
  } else {
    if (p.status !== "draft" && p.status !== "changes") throw new ReviewError("Only drafts or posts sent back can go to review.");
    next.status = "needs_review";
    if (clean) next.notes.push(`${actor}: ${clean}`);
  }
  d.posts.set(id, next);
  return scored(next, d.brand);
}

export async function addNote(id: string, actor: string, note: string): Promise<boolean> {
  const p = ensure().posts.get(id);
  const clean = note.trim().slice(0, NOTE_MAX);
  if (!p || !clean) return false;
  p.notes.push(`${actor}: ${clean}`);
  return true;
}

export async function reschedulePost(id: string, when: string): Promise<boolean> {
  const p = ensure().posts.get(id);
  if (!p) return false;
  p.scheduledFor = new Date(when).toISOString();
  return true;
}

export type DeskCounts = Record<PostStatus, number> & { total: number };

export async function deskCounts(): Promise<DeskCounts> {
  const c: DeskCounts = { draft: 0, needs_review: 0, changes: 0, approved: 0, published: 0, total: 0 };
  for (const p of ensure().posts.values()) {
    c[p.status] += 1;
    c.total += 1;
  }
  return c;
}

export type DeskModeStatus = { empty: boolean; demo: boolean; mode: DeskMode; connected: boolean; store: "memory"; count: number };

export async function deskStatus(): Promise<DeskModeStatus> {
  const d = ensure();
  const mode = currentDeskMode();
  return { empty: d.posts.size === 0, demo: mode === "demo", mode, connected: false, store: "memory", count: d.posts.size };
}

export async function loadDemoCatalog(): Promise<DeskModeStatus> {
  if (!demoAvailable()) throw new Error("Demo data is disabled on this deployment.");
  applyDemo();
  return deskStatus();
}

const CAPTION_MAX = 8000;
const ROLES: DeskRole[] = ["creator", "client", "admin"];

function clearSignOff(p: StoredPost) {
  if (p.status === "approved" || p.status === "published") {
    p.status = "needs_review";
    delete p.approvedBy;
    delete p.approvedAt;
  }
  delete p.internalSignOff;
}

function remember(p: StoredPost, actor: string, summary: string) {
  p.revisions.push({ id: nid("rev"), at: new Date().toISOString(), actor, summary, caption: p.caption });
}

export class DraftError extends Error {}

/** Rewrites a fragment (or the whole caption when start === end is not used — callers pass the range). */
export async function rewriteCaption(id: string, action: RewriteAction, start: number, end: number, actor: string): Promise<ScoredPost | null> {
  requireAccess("edit");
  const d = ensure();
  const p = d.posts.get(id);
  if (!p) return null;
  const next = clone(p);
  const from = Math.max(0, Math.min(start, end, next.caption.length));
  const to = Math.min(next.caption.length, Math.max(start, end));
  const slice = from === to ? next.caption : next.caption.slice(from, to);
  const rewritten = applyRewrite(slice, action, { channel: next.channel, pillar: next.pillar, brand: d.brand });
  if (rewritten.blocked) throw new DraftError(rewritten.blocked);
  const caption = (from === to ? rewritten.text : next.caption.slice(0, from) + rewritten.text + next.caption.slice(to)).trim();
  if (!caption) throw new DraftError("That rewrite left the draft empty.");
  if (caption === next.caption) return scored(next, d.brand);
  spendCredit(d);
  remember(next, actor, rewritten.summary);
  record(d, "post.rewritten", { id, action });
  next.caption = caption.slice(0, CAPTION_MAX);
  clearSignOff(next);
  d.posts.set(id, next);
  return scored(next, d.brand);
}

export async function saveDraft(id: string, patch: { caption?: string; hashtags?: string[]; asset?: string }, actor: string): Promise<ScoredPost | null> {
  requireAccess("edit");
  const d = ensure();
  const p = d.posts.get(id);
  if (!p) return null;
  const next = clone(p);
  let changed = false;
  if (typeof patch.caption === "string") {
    const caption = patch.caption.trim().slice(0, CAPTION_MAX);
    if (!caption) throw new DraftError("The caption can't be empty.");
    if (caption !== next.caption) {
      remember(next, actor, "Edited the draft");
      next.caption = caption;
      changed = true;
    }
  }
  if (Array.isArray(patch.hashtags)) {
    const tags = [...new Set(patch.hashtags.map((t) => t.replace(/^#/, "").trim().toLowerCase()).filter((t) => /^[\p{L}\p{N}_]{1,40}$/u.test(t)))].slice(0, 30);
    if (tags.join() !== next.hashtags.join()) {
      next.hashtags = tags;
      changed = true;
    }
  }
  if (typeof patch.asset === "string") {
    const asset = patch.asset.trim().slice(0, 280);
    if (asset !== next.asset) {
      next.asset = asset;
      changed = true;
    }
  }
  if (changed) clearSignOff(next);
  d.posts.set(id, next);
  return scored(next, d.brand);
}

export async function addComment(id: string, actor: string, role: DeskRole, body: string): Promise<boolean> {
  const p = ensure().posts.get(id);
  const clean = body.trim().slice(0, NOTE_MAX);
  if (!p || !clean || !ROLES.includes(role)) return false;
  const next = clone(p);
  next.comments.push({ id: nid("c"), actor, role, body: clean, at: new Date().toISOString() });
  ensure().posts.set(id, next);
  return true;
}

const MEDIA_MAX = 6;

function safeMediaUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString().slice(0, 500);
  } catch {
    return null;
  }
}

export async function addMedia(id: string, item: { label: string; url: string; kind: MediaItem["kind"]; source: MediaItem["source"] } | { stockId: string } | { libraryId: string }): Promise<ScoredPost | null> {
  requireAccess("edit");
  const d = ensure();
  const p = d.posts.get(id);
  if (!p) return null;
  const next = clone(p);
  if (next.media.length >= MEDIA_MAX) throw new DraftError(`A post holds up to ${MEDIA_MAX} files.`);
  let media: MediaItem;
  if ("libraryId" in item) {
    const asset = d.assets.find((entry) => entry.id === item.libraryId);
    if (!asset || !asset.approved || asset.kind === "prompt" || !asset.url) throw new DraftError("Only a brand-approved image or video can be attached.");
    media = { id: nid("m"), kind: asset.kind === "video" ? "video" : "image", label: asset.name, url: asset.url, source: "upload" };
  } else if ("stockId" in item) {
    const stock = stockById(item.stockId);
    if (!stock || stock.pillar !== next.pillar) throw new DraftError("That stock frame doesn't match this pillar.");
    media = { id: nid("m"), kind: "image", label: stock.label, url: stock.url, source: "stock" };
  } else {
    const url = safeMediaUrl(item.url);
    if (!url) throw new DraftError("Use an http(s) link to the file.");
    media = { id: nid("m"), kind: item.kind === "video" ? "video" : "image", label: item.label.trim().slice(0, 80) || "Attachment", url, source: item.source === "stock" ? "stock" : "upload" };
  }
  next.media.push(media);
  d.posts.set(id, next);
  return scored(next, d.brand);
}

export async function removeMedia(id: string, mediaId: string): Promise<boolean> {
  const p = ensure().posts.get(id);
  if (!p) return false;
  const next = clone(p);
  const before = next.media.length;
  next.media = next.media.filter((m) => m.id !== mediaId);
  if (next.media.length === before) return false;
  ensure().posts.set(id, next);
  return true;
}

export async function updateBrand(patch: { voice?: string[]; avoid?: string[]; directives?: string }): Promise<Brand> {
  requireAccess("brand");
  const d = ensure();
  const clean = (list: string[] | undefined, max: number) =>
    (list ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean).map((s) => s.slice(0, 40)).slice(0, max);
  if (patch.voice) d.brand.voice = [...new Set(clean(patch.voice, 8))];
  if (patch.avoid) d.brand.avoid = [...new Set(clean(patch.avoid, 20))];
  if (typeof patch.directives === "string") d.brand.directives = patch.directives.trim().slice(0, 800);
  return d.brand;
}

/** Drafts a channel-native version of a post. The source stays as it is. */
export async function repurposePost(id: string, target: Channel): Promise<ScoredPost | null> {
  requireAccess("edit");
  const d = ensure();
  const p = d.posts.get(id);
  if (!p) return null;
  if (p.status !== "approved") throw new DraftError("Repurpose an approved post so the other channels start from signed-off copy.");
  if (target === p.channel) throw new DraftError("Pick a different channel.");
  const draft = repurposeDraft(p, target, d.brand);
  const slot = suggestSlot(target, p.pillar);
  const created: Post = {
    id: nid(`rep-${target}`),
    channel: target,
    pillar: p.pillar,
    scheduledFor: slot.iso,
    caption: draft.caption,
    hashtags: draft.hashtags,
    asset: p.asset,
    status: "draft",
    createdBy: "helix_ai",
    notes: [`Repurposed from the approved ${p.channel} post.`],
    comments: [],
    revisions: [],
    media: nextMedia(p),
    sourcePostId: p.id,
  };
  d.posts.set(created.id, created);
  return scored(created, d.brand);
}

function nextMedia(p: Post): Post["media"] {
  return (p.media ?? []).map((m) => ({ ...m, id: nid("m") }));
}

export type BatchFilter = { channel?: Channel | null; pillar?: Post["pillar"] | null; from?: string | null; to?: string | null };

function inBatch(post: Post, filter?: BatchFilter): boolean {
  if (!filter) return true;
  if (filter.channel && post.channel !== filter.channel) return false;
  if (filter.pillar && post.pillar !== filter.pillar) return false;
  const day = post.scheduledFor.slice(0, 10);
  if (filter.from && day < filter.from) return false;
  if (filter.to && day > filter.to) return false;
  return true;
}

/** Approves every in-review post with a perfect score that matches the filter. Nothing is published. */
export async function approvePerfect(actor: string, filter?: BatchFilter): Promise<{ approved: string[]; stepped: string[] }> {
  const d = ensure();
  const role = root().sessionRole;
  if (role === "creator") throw new AccessError("Creators draft. A manager or the client approves.");
  const approved: string[] = [];
  const stepped: string[] = [];
  for (const p of d.posts.values()) {
    if (p.status !== "needs_review" || !inBatch(p, filter)) continue;
    const readiness = scoreReadiness(p, d.brand);
    if (readiness.score !== 100 || hardBlockers(readiness.factors).length) continue;
    const next = clone(p);
    const needsClient = d.approval === "manager_then_client";
    if (needsClient && !p.internalSignOff) {
      if (role === "client") continue;
      next.internalSignOff = { by: actor, at: new Date().toISOString() };
      next.notes.push(`${actor}: Internal sign-off in bulk. Waiting for the client.`);
      d.posts.set(p.id, next);
      stepped.push(p.id);
      continue;
    }
    if (needsClient && role === "manager") continue;
    if (!needsClient && role === "client") continue;
    finalize(next, actor);
    next.notes.push(`${actor}: Approved in bulk — score 100.`);
    d.posts.set(p.id, next);
    approved.push(p.id);
  }
  if (approved.length) record(d, "post.bulk_approved", { ids: approved });
  if (stepped.length) record(d, "post.bulk_internal", { ids: stepped });
  return { approved, stepped };
}

export async function previewAutoFix(id: string): Promise<{ before: string; after: string } | null> {
  requireAccess("edit");
  const d = ensure();
  const post = d.posts.get(id);
  if (!post) return null;
  const fixed = autoFixDraft(post, d.brand);
  return { before: post.caption, after: fixed.caption };
}

export async function autoFixPost(id: string, actor: string): Promise<ScoredPost | null> {
  requireAccess("edit");
  const d = ensure();
  const p = d.posts.get(id);
  if (!p) return null;
  const fixed = autoFixDraft(p, d.brand);
  const next = clone(p);
  if (fixed.caption === next.caption && fixed.hashtags.join() === next.hashtags.join() && fixed.asset === next.asset) {
    return scored(next, d.brand);
  }
  spendCredit(d);
  remember(next, actor, "Auto-fix to a perfect readiness score");
  next.caption = fixed.caption;
  next.hashtags = fixed.hashtags;
  next.asset = fixed.asset;
  clearSignOff(next);
  d.posts.set(id, next);
  record(d, "post.autofix", { id });
  return scored(next, d.brand);
}

export type ShellSession = {
  role: AccessRole;
  plan: PlanId;
  workspaceId: string;
  approval: ApprovalMode;
  creditsUsed: number;
  creditsLimit: number;
  accountLimit: number;
  workspaceLimit: number;
  workspaces: { id: string; name: string }[];
};

export async function shellSession(): Promise<ShellSession> {
  const ws = ensure();
  const r = root();
  const plan = PLANS[r.plan];
  return {
    role: r.sessionRole,
    plan: r.plan,
    workspaceId: ws.id,
    approval: ws.approval,
    creditsUsed: ws.creditsUsed,
    creditsLimit: plan.credits,
    accountLimit: plan.accounts,
    workspaceLimit: plan.workspaces,
    workspaces: [...r.workspaces.values()].map((item) => ({ id: item.id, name: item.brand.name })),
  };
}

export async function switchWorkspace(id: string): Promise<ShellSession> {
  const r = root();
  ensure();
  if (!r.workspaces.has(id)) throw new DraftError("That workspace is not on this desk.");
  r.activeId = id;
  return shellSession();
}

export async function setSessionRole(role: AccessRole): Promise<ShellSession> {
  ensure();
  root().sessionRole = role;
  return shellSession();
}

export async function setApprovalMode(mode: ApprovalMode): Promise<ShellSession> {
  requireAccess("brand");
  ensure().approval = mode;
  return shellSession();
}

export async function setPlan(plan: PlanId): Promise<ShellSession> {
  requireAccess("billing");
  root().plan = plan;
  return shellSession();
}

export async function createWorkspace(name: string): Promise<ShellSession> {
  requireAccess("billing");
  const r = root();
  ensure();
  const limit = PLANS[r.plan].workspaces;
  if (r.workspaces.size >= limit) throw new DraftError(`The ${PLANS[r.plan].label} plan holds ${limit} workspaces.`);
  const id = nid("ws");
  const brand = { ...EMPTY_BRAND, name: name.trim().slice(0, 60) || "New brand" };
  r.workspaces.set(id, emptyWorkspace(id, brand));
  r.activeId = id;
  return shellSession();
}

export async function listAssets(): Promise<LibraryAsset[]> {
  return ensure().assets.map((asset) => ({ ...asset, tags: [...asset.tags] }));
}

export async function addLibraryAsset(input: { name: string; folder: string; tags: string[]; url?: string; prompt?: string; kind?: LibraryAsset["kind"] }): Promise<LibraryAsset> {
  requireAccess("edit");
  const ws = ensure();
  const kind = input.kind === "video" || input.kind === "logo" || input.kind === "prompt" ? input.kind : "image";
  const url = input.url?.trim() ? safeMediaUrl(input.url) : "";
  if (input.url?.trim() && !url) throw new DraftError("Use an http(s) link to the file.");
  if (kind !== "prompt" && !url) throw new DraftError("An image or video needs a link.");
  const asset: LibraryAsset = {
    id: nid("lib"),
    name: input.name.trim().slice(0, 80) || "Untitled",
    kind,
    url: url || "",
    folder: input.folder.trim().slice(0, 40) || "General",
    tags: [...new Set(input.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 8),
    approved: false,
    prompt: input.prompt?.trim().slice(0, 280),
  };
  ws.assets.unshift(asset);
  return asset;
}

export async function setAssetApproval(id: string, approved: boolean): Promise<boolean> {
  requireAccess("library");
  const asset = ensure().assets.find((item) => item.id === id);
  if (!asset) return false;
  asset.approved = approved;
  return true;
}

export async function listMembers(): Promise<Member[]> {
  return ensure().members.map((member) => ({ ...member }));
}

export async function addWebhook(url: string, events: string[]): Promise<WebhookEndpoint> {
  requireAccess("webhook");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DraftError("Webhook URL must be https.");
  }
  if (parsed.protocol !== "https:") throw new DraftError("Webhook URL must be https.");
  const ws = ensure();
  const hook: WebhookEndpoint = { id: nid("hook"), url: parsed.toString().slice(0, 300), events: events.filter((event) => typeof event === "string").slice(0, 6) };
  ws.webhooks.push(hook);
  return hook;
}

export async function listWebhooks(): Promise<{ hooks: WebhookEndpoint[]; outbox: WebhookDelivery[] }> {
  const ws = ensure();
  return { hooks: ws.webhooks.map((hook) => ({ ...hook, events: [...hook.events] })), outbox: ws.outbox.map((item) => ({ ...item, payload: { ...item.payload } })) };
}

export async function createReport(): Promise<ExecutiveReport> {
  const ws = ensure();
  const posts = [...ws.posts.values()];
  const scores = posts.map((post) => scoreReadiness(post, ws.brand).score);
  const pillars = (["product", "behind_the_scenes", "education", "community", "promo"] as const).map((pillar) => {
    const rows = posts.filter((post) => post.pillar === pillar);
    const rowScores = rows.map((post) => scoreReadiness(post, ws.brand).score);
    return { pillar, count: rows.length, avgScore: rowScores.length ? Math.round(rowScores.reduce((sum, score) => sum + score, 0) / rowScores.length) : 0 };
  });
  const report: ExecutiveReport = {
    id: nid("rpt"),
    createdAt: new Date().toISOString(),
    workspaceName: ws.brand.name,
    total: posts.length,
    approved: posts.filter((post) => post.status === "approved").length,
    perfect: scores.filter((score) => score === 100).length,
    avgScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
    pillars,
    note: "This report counts planned posts and readiness scores. It has no engagement, because nothing from this desk has been published.",
  };
  ws.reports.unshift(report);
  return report;
}

export async function getReport(id: string): Promise<ExecutiveReport | null> {
  const report = ensure().reports.find((item) => item.id === id);
  return report ? { ...report, pillars: report.pillars.map((pillar) => ({ ...pillar })) } : null;
}

const CASCADE: Channel[] = ["x", "linkedin", "instagram", "tiktok"];

function placeDraft(ws: Workspace, draft: Post): ScoredPost {
  ws.posts.set(draft.id, draft);
  return scored(draft, ws.brand);
}

/** Builds one draft from a typed command and the brand voice already saved. Does not fetch a URL. */
export async function composeFromText(text: string, actor: string): Promise<ScoredPost> {
  requireAccess("edit");
  const parsed = parseCompose(text);
  if (!parsed) throw new DraftError("Name a channel, such as LinkedIn, and what the post is about.");
  const ws = ensure();
  const body = composeDraft(ws.brand, parsed.channel, parsed.topic);
  const slot = suggestSlot(parsed.channel, body.pillar);
  const notes = knowledgeLines(ws.brand.directives);
  const created: Post = {
    id: nid("cmd"),
    channel: parsed.channel,
    pillar: body.pillar,
    scheduledFor: slot.iso,
    caption: body.caption,
    hashtags: body.hashtags,
    asset: body.asset,
    status: parsed.submit ? "needs_review" : "draft",
    createdBy: "helix_ai",
    notes: [`${actor}: Built from the brand voice on this desk.${notes.length ? " Included a pasted note." : ""} No page was opened.`],
    comments: [],
    revisions: [],
    media: [],
  };
  record(ws, "post.composed", { id: created.id, channel: created.channel });
  return placeDraft(ws, created);
}

/** Fills local days in the next three that have no post. Each draft waits for approval. */
export async function fillOpenDays(actor: string): Promise<number> {
  requireAccess("edit");
  const ws = ensure();
  const taken = new Set(
    [...ws.posts.values()].map((post) => {
      const day = new Date(post.scheduledFor);
      return `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    })
  );
  let made = 0;
  for (let offset = 0; offset < 3; offset += 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + offset);
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    if (taken.has(key)) continue;
    const channel: Channel = "instagram";
    const topic = `${ws.brand.name} update`;
    const body = composeDraft(ws.brand, channel, topic);
    day.setHours(suggestSlot(channel, body.pillar).hour, 0, 0, 0);
    placeDraft(ws, {
      id: nid("gap"),
      channel,
      pillar: body.pillar,
      scheduledFor: day.toISOString(),
      caption: body.caption,
      hashtags: body.hashtags,
      asset: body.asset,
      status: "needs_review",
      createdBy: "helix_ai",
      notes: [`${actor}: Filled an empty day. Waiting for approval. Nothing is published.`],
      comments: [],
      revisions: [],
      media: [],
    });
    made += 1;
  }
  if (made) record(ws, "calendar.filled", { count: made });
  return made;
}

/** Channel versions of one seed. Captions come from the form rewriter, and the TikTok timing sits in the notes. */
export async function cascadePost(id: string, actor: string): Promise<string[]> {
  requireAccess("edit");
  const ws = ensure();
  const source = ws.posts.get(id);
  if (!source) throw new DraftError("That post is not on this desk.");
  const existing = new Set([...ws.posts.values()].filter((post) => post.sourcePostId === id).map((post) => post.channel));
  const made: string[] = [];
  for (const target of CASCADE) {
    if (target === source.channel || existing.has(target)) continue;
    const draft = repurposeDraft(source, target, ws.brand);
    const slot = suggestSlot(target, source.pillar);
    const sentences = source.caption.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 4);
    const thread = sentences.map((line, index) => `${index + 1}/${sentences.length} ${line}`).join(" | ");
    const script = sentences.map((line, index) => `0:${String(index * 8).padStart(2, "0")} ${line}`).join(" ");
    const slides = ["Cover", "The point", "The proof", "The close"].map((label, index) => `Slide ${index + 1} ${label}: ${sentences[index] ?? source.asset}`).join(" ");
    const shaped =
      target === "x"
        ? { asset: source.asset, note: `Thread: ${thread}` }
        : target === "linkedin"
          ? { asset: source.asset, note: "Long post from the seed, fit to the LinkedIn length check." }
          : target === "instagram"
            ? { asset: slides, note: "Carousel prompts are in the visual brief. No image was generated." }
            : { asset: source.asset, note: `Script: ${script}` };
    const created: Post = {
      id: nid(`set-${target}`),
      channel: target,
      pillar: source.pillar,
      scheduledFor: slot.iso,
      caption: draft.caption,
      hashtags: draft.hashtags,
      asset: shaped.asset.slice(0, 280),
      status: "draft",
      createdBy: "helix_ai",
      notes: [`${actor}: ${shaped.note}`],
      comments: [],
      revisions: [],
      media: nextMedia(source),
      sourcePostId: source.id,
    };
    placeDraft(ws, created);
    made.push(created.id);
  }
  if (!made.length) throw new DraftError("Every other channel already has a version of this post.");
  record(ws, "post.cascaded", { id, count: made.length });
  return made;
}

/** A later copy of signed-off wording. Rank is not used, because this desk has no engagement. */
export async function evergreenCopy(id: string, months: 3 | 6, actor: string): Promise<ScoredPost> {
  requireAccess("edit");
  const ws = ensure();
  const source = ws.posts.get(id);
  if (!source) throw new DraftError("That post is not on this desk.");
  if (source.status !== "approved") throw new DraftError("Schedule a later copy from a post that is already approved.");
  const when = new Date(source.scheduledFor);
  when.setMonth(when.getMonth() + months);
  const created: Post = {
    id: nid("ever"),
    channel: source.channel,
    pillar: source.pillar,
    scheduledFor: when.toISOString(),
    caption: source.caption,
    hashtags: [...source.hashtags],
    asset: source.asset,
    status: "needs_review",
    createdBy: "helix_ai",
    notes: [`${actor}: Later copy of signed-off wording, ${months} months out. Not ranked by results.`],
    comments: [],
    revisions: [],
    media: nextMedia(source),
    sourcePostId: source.id,
  };
  record(ws, "post.evergreen", { id, months });
  return placeDraft(ws, created);
}

export async function setAutopilot(on: boolean, actor: string): Promise<{ on: boolean; filled: number }> {
  requireAccess("edit");
  const filled = on ? await fillOpenDays(actor) : 0;
  const ws = ensure();
  ws.autopilot = on;
  record(ws, on ? "autopilot.on" : "autopilot.off", { filled });
  return { on, filled };
}

export async function autopilotEnabled(): Promise<boolean> {
  return Boolean(ensure().autopilot);
}

export async function ensureReviewToken(): Promise<string> {
  const ws = ensure();
  ws.reviewToken ??= nid("share");
  return ws.reviewToken;
}

function workspaceByToken(token: string): Workspace | undefined {
  return [...root().workspaces.values()].find((ws) => ws.reviewToken === token);
}

export async function postsForReviewToken(token: string): Promise<{ brand: string; posts: ScoredPost[] } | null> {
  const ws = workspaceByToken(token);
  if (!ws) return null;
  const posts = [...ws.posts.values()]
    .map((post) => scored(post, ws.brand))
    .filter((post) => post.status === "needs_review" && post.readiness.score === 100);
  return { brand: ws.brand.name, posts };
}

export async function commentFromReviewToken(token: string, id: string, body: string): Promise<boolean> {
  const ws = workspaceByToken(token);
  if (!ws) return false;
  const post = ws.posts.get(id);
  const clean = body.trim().slice(0, NOTE_MAX);
  if (!post || !clean) return false;
  const next = clone(post);
  next.comments.push({ id: nid("c"), actor: "Client link", role: "client", body: clean, at: new Date().toISOString() });
  ws.posts.set(id, next);
  record(ws, "post.comment", { id, via: "review-link" });
  return true;
}

export async function approveFromReviewToken(token: string, id: string): Promise<boolean> {
  const ws = workspaceByToken(token);
  if (!ws) return false;
  const post = ws.posts.get(id);
  if (!post || post.status !== "needs_review") throw new ReviewError("That post is not waiting in this link.");
  const readiness = scoreReadiness(post, ws.brand);
  if (readiness.score !== 100 || hardBlockers(readiness.factors).length) throw new ReviewError("Only a score of 100 can be signed off from this link.");
  const next = clone(post);
  finalize(next, "Client link");
  next.notes.push("Client link: Approved from the review link. Nothing was published.");
  ws.posts.set(id, next);
  record(ws, "post.approved", { id, actor: "Client link" });
  return true;
}

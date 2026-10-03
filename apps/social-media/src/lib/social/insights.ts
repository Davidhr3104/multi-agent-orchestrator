import { metaConfig, type FetchLike } from "./config";
import { readFacebook, readInstagram, verifyMetaToken, type AccountSummary, type MetaVerification, type NetworkRead, type RealPost } from "./meta-graph";

/** Real account data from the Graph API. Kept apart from the desk's planned posts and from demo seeds. */
export type InsightsSnapshot = {
  fetchedAt: string;
  verification: MetaVerification;
  instagram: NetworkRead;
  facebook: NetworkRead;
};

type State = { snapshot: InsightsSnapshot | null };

function state(): State {
  const g = globalThis as typeof globalThis & { __helixSocialInsights?: State };
  g.__helixSocialInsights ??= { snapshot: null };
  return g.__helixSocialInsights;
}

export const INSIGHTS_MAX_AGE_MS = 15 * 60 * 1000;

const skipped = (error: string): NetworkRead => ({ ok: false, error });

/** Reads Meta now. Returns null when no Meta token is configured. */
export async function refreshInsights(fetchImpl: FetchLike = fetch, now = new Date()): Promise<InsightsSnapshot | null> {
  const cfg = metaConfig();
  if (!cfg) {
    state().snapshot = null;
    return null;
  }
  const verification = await verifyMetaToken(cfg, fetchImpl, now);
  const snapshot: InsightsSnapshot = verification.ok
    ? { fetchedAt: now.toISOString(), verification, instagram: await readInstagram(cfg, fetchImpl, now), facebook: await readFacebook(cfg, fetchImpl, now) }
    : { fetchedAt: now.toISOString(), verification, instagram: skipped("Token check failed, so nothing was read."), facebook: skipped("Token check failed, so nothing was read.") };
  state().snapshot = snapshot;
  return snapshot;
}

/** Cached snapshot, refreshed when older than maxAgeMs. */
export async function currentInsights(opts: { maxAgeMs?: number; fetchImpl?: FetchLike } = {}): Promise<InsightsSnapshot | null> {
  if (!metaConfig()) return null;
  const snap = state().snapshot;
  const maxAge = opts.maxAgeMs ?? INSIGHTS_MAX_AGE_MS;
  if (snap && Date.now() - Date.parse(snap.fetchedAt) < maxAge) return snap;
  try {
    return await refreshInsights(opts.fetchImpl ?? fetch);
  } catch {
    return snap;
  }
}

export function cachedInsights(): InsightsSnapshot | null {
  return state().snapshot;
}

export function resetInsights() {
  state().snapshot = null;
}

export function realPosts(snap: InsightsSnapshot | null): RealPost[] {
  if (!snap) return [];
  return [snap.instagram, snap.facebook].flatMap((read) => (read.ok ? read.posts : []));
}

export function realAccounts(snap: InsightsSnapshot | null): AccountSummary[] {
  if (!snap) return [];
  return [snap.instagram, snap.facebook].flatMap((read) => (read.ok ? [read.account] : []));
}

/** Connected means Meta validated the token and at least one account read succeeded. */
export function metaConnected(snap: InsightsSnapshot | null): { instagram: boolean; facebook: boolean } {
  const ok = Boolean(snap?.verification.ok);
  return { instagram: ok && Boolean(snap?.instagram.ok), facebook: ok && Boolean(snap?.facebook.ok) };
}

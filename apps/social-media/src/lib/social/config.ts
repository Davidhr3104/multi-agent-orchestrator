/**
 * Env-only configuration for the network adapters. Token values stay on the server and are never returned to the UI.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const read = (name: string) => process.env[name]?.trim() || "";

export const DEFAULT_GRAPH_VERSION = "v23.0";
export const DEFAULT_LINKEDIN_VERSION = "202509";

export type MetaConfig = {
  token: string;
  /** Page access token for Page reads and posts. Falls back to the main token. */
  pageToken: string;
  pageId: string;
  igUserId: string;
  graphVersion: string;
};

export type LinkedInConfig = { token: string; organizationUrn: string; version: string };

export function metaConfig(): MetaConfig | null {
  const token = read("HELIX_META_ACCESS_TOKEN");
  if (!token) return null;
  return {
    token,
    pageToken: read("HELIX_META_PAGE_ACCESS_TOKEN") || token,
    pageId: read("HELIX_META_PAGE_ID"),
    igUserId: read("HELIX_META_IG_USER_ID"),
    graphVersion: read("HELIX_META_GRAPH_VERSION") || DEFAULT_GRAPH_VERSION,
  };
}

export function linkedInConfig(): LinkedInConfig | null {
  const token = read("HELIX_LINKEDIN_ACCESS_TOKEN");
  const raw = read("HELIX_LINKEDIN_ORGANIZATION_URN");
  if (!token || !raw) return null;
  const organizationUrn = /^\d+$/.test(raw) ? `urn:li:organization:${raw}` : raw;
  if (!/^urn:li:organization:\d+$/.test(organizationUrn)) return null;
  return { token, organizationUrn, version: read("HELIX_LINKEDIN_VERSION") || DEFAULT_LINKEDIN_VERSION };
}

export function publishSwitchOn(): boolean {
  return read("HELIX_SOCIAL_PUBLISH").toLowerCase() === "live";
}

/** Error from a network API. The message never contains a token. */
export class NetworkError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null
  ) {
    super(message);
  }
}

/** Removes anything that looks like an access token from an upstream error message. */
export function scrub(text: string): string {
  return text.replace(/access_token=[^&\s"]+/gi, "access_token=***").replace(/\b(EAA|AQ)[A-Za-z0-9_-]{20,}/g, "***").slice(0, 300);
}

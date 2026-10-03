import type { Channel } from "./types";

/** Env names only. Values are never read into the UI. */
const TOKEN_ENV: Record<Channel, string> = {
  instagram: "HELIX_META_ACCESS_TOKEN",
  facebook: "HELIX_META_ACCESS_TOKEN",
  linkedin: "HELIX_LINKEDIN_ACCESS_TOKEN",
  x: "HELIX_X_ACCESS_TOKEN",
  tiktok: "HELIX_TIKTOK_ACCESS_TOKEN",
};

const EXPIRES_ENV: Record<Channel, string> = {
  instagram: "HELIX_META_TOKEN_EXPIRES",
  facebook: "HELIX_META_TOKEN_EXPIRES",
  linkedin: "HELIX_LINKEDIN_TOKEN_EXPIRES",
  x: "HELIX_X_TOKEN_EXPIRES",
  tiktok: "HELIX_TIKTOK_TOKEN_EXPIRES",
};

/** read_and_publish: Graph API reads and posts. publish: posts only. token_only: no code reads or writes with the token. */
export type AdapterKind = "read_and_publish" | "publish" | "token_only";

const ADAPTER: Record<Channel, AdapterKind> = {
  instagram: "read_and_publish",
  facebook: "read_and_publish",
  linkedin: "publish",
  x: "token_only",
  tiktok: "token_only",
};

const EXTRA_ENV: Record<Channel, { name: string; optional?: boolean }[]> = {
  instagram: [{ name: "HELIX_META_IG_USER_ID" }],
  facebook: [{ name: "HELIX_META_PAGE_ID" }, { name: "HELIX_META_PAGE_ACCESS_TOKEN", optional: true }],
  linkedin: [{ name: "HELIX_LINKEDIN_ORGANIZATION_URN" }],
  x: [],
  tiktok: [],
};

export type ChannelConnection = {
  channel: Channel;
  tokenEnv: string;
  expiresEnv: string;
  credentialPresent: boolean;
  /** missing = no token. set = token present, expiry unknown or still ahead. expired = expiry is in the past. Not proof the token works. */
  tokenState: "missing" | "set" | "expired";
  adapter: AdapterKind;
  extraEnv: { name: string; optional: boolean; present: boolean }[];
};

export type ConnectionReport = {
  /** True only when an operator set the live switch. Each post still needs a person's approval and Publish press. */
  publishSwitch: boolean;
  channels: ChannelConnection[];
};

export function connectionReport(): ConnectionReport {
  return {
    publishSwitch: process.env.HELIX_SOCIAL_PUBLISH?.trim().toLowerCase() === "live",
    channels: (Object.keys(TOKEN_ENV) as Channel[]).map((channel) => {
      const credentialPresent = Boolean(process.env[TOKEN_ENV[channel]]?.trim());
      const rawExpiry = process.env[EXPIRES_ENV[channel]]?.trim();
      const expiry = rawExpiry ? Date.parse(rawExpiry) : Number.NaN;
      const expired = credentialPresent && !Number.isNaN(expiry) && expiry <= Date.now();
      return {
        channel,
        tokenEnv: TOKEN_ENV[channel],
        expiresEnv: EXPIRES_ENV[channel],
        credentialPresent,
        tokenState: !credentialPresent ? "missing" : expired ? "expired" : "set",
        adapter: ADAPTER[channel],
        extraEnv: EXTRA_ENV[channel].map((env) => ({ name: env.name, optional: Boolean(env.optional), present: Boolean(process.env[env.name]?.trim()) })),
      } as const;
    }),
  };
}

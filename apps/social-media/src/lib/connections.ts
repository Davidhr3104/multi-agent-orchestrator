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

export type ChannelConnection = {
  channel: Channel;
  tokenEnv: string;
  expiresEnv: string;
  credentialPresent: boolean;
  /** missing = no token. set = token present, expiry unknown or still ahead. expired = expiry is in the past. */
  tokenState: "missing" | "set" | "expired";
};

export type ConnectionReport = {
  /** True only when an operator set the live switch. This build still has no adapter that posts. */
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
      } as const;
    }),
  };
}

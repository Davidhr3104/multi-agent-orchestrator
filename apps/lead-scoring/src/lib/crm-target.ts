import { isGhlConfigured } from "./ghl";
import { isHubspotConfigured } from "./hubspot";
import type { CrmTarget } from "./lead-ai";

/** Explicit target wins (if connected); otherwise GoHighLevel when connected, then HubSpot. */
export function resolveCrmTarget(requested?: unknown): CrmTarget | null {
  if (requested === "hubspot") return isHubspotConfigured() ? "hubspot" : null;
  if (requested === "ghl") return isGhlConfigured() ? "ghl" : null;
  if (isGhlConfigured()) return "ghl";
  if (isHubspotConfigured()) return "hubspot";
  return null;
}

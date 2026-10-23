import type { SettingsAuthOptions } from "@helix/core";
import { authedUser } from "@/lib/org-auth";

/** Signed-in Leads users count as settings auth, alongside the operator key. */
export async function leadsSettingsAuth(): Promise<SettingsAuthOptions> {
  return { session: Boolean(await authedUser()) };
}

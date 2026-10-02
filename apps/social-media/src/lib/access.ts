import type { AccessRole } from "./types";

export type AccessAction = "edit" | "approve" | "brand" | "billing" | "library" | "webhook";

/** Owner can do everything. Manager runs the desk except plan and webhooks. Creator drafts. Client comments and, when asked, gives the second sign-off. */
export function can(role: AccessRole, action: AccessAction): boolean {
  if (role === "owner") return true;
  if (role === "manager") return action !== "billing" && action !== "webhook";
  if (role === "creator") return action === "edit";
  return false;
}

export const ROLE_LABEL: Record<AccessRole, string> = {
  owner: "Owner",
  manager: "Manager",
  creator: "Creator",
  client: "Client",
};

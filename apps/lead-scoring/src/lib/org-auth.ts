import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSecret } from "@helix/core";
import { verifyActionToken, type LeadAction } from "@helix/core/action-token";
import { getSupabase } from "./supabase-leads";

export type AuthedUser = { id: string; email: string | null };
export type OrgMembership = {
  orgId: string;
  orgName: string;
  role: "owner" | "operator" | "viewer";
  webhookToken?: string;
  logoUrl?: string;
  primaryColor?: string;
};

export function anonSupabaseConfigured(): boolean {
  return Boolean(getSecret("NEXT_PUBLIC_SUPABASE_URL") && getSecret("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
}

/**
 * Auth client bound to the request's cookies — resolves who the signed-in
 * user is. Uses the anon key (not the service-role key), so it only ever
 * sees what that user's session allows.
 */
export async function authedUser(): Promise<AuthedUser | null> {
  if (!anonSupabaseConfigured()) return null;
  const url = getSecret("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getSecret("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const jar = await cookies();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: () => {
        // Route handlers that need to refresh the session set cookies via the
        // response they return, not here — this accessor is read-only.
      },
    },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}

/**
 * Looks up the caller's org via the service-role client (bypasses RLS by
 * design — org_members itself is not tenant-scoped data, membership is the
 * thing granting scope). Returns null if the user has no org yet.
 */
export async function currentOrg(userId: string): Promise<OrgMembership | null> {
  const db = getSupabase();
  if (!db) return null;
  const table = (
    db as unknown as {
      schema: (name: string) => {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (
              col: string,
              value: string
            ) => {
              maybeSingle: () => Promise<{
                data: {
                  org_id: string;
                  role: string;
                  organizations: {
                    name: string;
                    webhook_token: string;
                    logo_url: string | null;
                    primary_color: string | null;
                  } | null;
                } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    }
  )
    .schema("lead_scoring")
    .from("org_members");
  const { data, error } = await table
    .select("org_id, role, organizations(name, webhook_token, logo_url, primary_color)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    orgId: data.org_id,
    orgName: data.organizations?.name ?? "Workspace",
    webhookToken: data.organizations?.webhook_token,
    logoUrl: data.organizations?.logo_url ?? undefined,
    primaryColor: data.organizations?.primary_color ?? undefined,
    role: (data.role as OrgMembership["role"]) ?? "operator",
  };
}

/**
 * Resolves the authenticated user's org for the current request. Returns
 * null when auth is not configured (legacy operator-key-only mode), or when
 * the user isn't signed in / has no org — callers decide how to handle each.
 */
export async function requireOrgScope(): Promise<
  { user: AuthedUser; org: OrgMembership } | null
> {
  const user = await authedUser();
  if (!user) return null;
  const org = await currentOrg(user.id);
  if (!org) return null;
  return { user, org };
}

/**
 * The orgId to scope a request's store calls by.
 *
 * Returns:
 *  - a real org id, once org auth is set up and the caller is signed in with
 *    a membership — this is the target state, and every desk should end up
 *    here in production.
 *  - undefined when org auth isn't configured at all (no NEXT_PUBLIC_SUPABASE_*
 *    anon key set up for user sessions) — legacy single-tenant/operator-key
 *    mode, store.ts treats this the same as local/demo.
 *
 * Throws when org auth IS configured but the caller has no session or no
 * org membership — that's a real access problem, not a mode to silently
 * fall back from (never fail silently: see CLAUDE.md).
 */
export async function resolveOrgScope(): Promise<string | undefined> {
  if (!anonSupabaseConfigured()) return undefined;
  const scope = await requireOrgScope();
  if (!scope) {
    throw new OrgScopeError("Sign in and join a workspace before using this desk.");
  }
  return scope.org.orgId;
}

export class OrgScopeError extends Error {}

/**
 * Resolves an org by its webhook token — for inbound webhooks (e.g. GHL),
 * which are server-to-server calls with no browser session/cookie to read a
 * user from. The token lives in the webhook URL GHL is configured to call,
 * not in a login flow.
 */
export async function orgIdForWebhookToken(token: string): Promise<string | null> {
  const db = getSupabase();
  if (!db) return null;
  const table = (
    db as unknown as {
      schema: (name: string) => {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (
              col: string,
              value: string
            ) => {
              maybeSingle: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
            };
          };
        };
      };
    }
  )
    .schema("lead_scoring")
    .from("organizations");
  const { data, error } = await table.select("id").eq("webhook_token", token).maybeSingle();
  if (error || !data) return null;
  return data.id;
}

/**
 * Creates a personal org for a first-time signed-in user and makes them its
 * owner. No-op (returns the existing membership) if they already have one —
 * the simple-org model is one org per user, never a second membership.
 */
export async function bootstrapOrgForUser(user: AuthedUser): Promise<OrgMembership> {
  const existing = await currentOrg(user.id);
  if (existing) return existing;

  const db = getSupabase();
  if (!db) throw new Error("Supabase is not configured");
  const orgsTable = (
    db as unknown as {
      schema: (name: string) => {
        from: (table: string) => {
          insert: (row: Record<string, unknown>) => {
            select: (cols: string) => {
              single: () => Promise<{
                data: { id: string; webhook_token: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    }
  )
    .schema("lead_scoring")
    .from("organizations");

  const name = user.email ? `${user.email.split("@")[0]}'s workspace` : "Workspace";
  const slug = `${(user.email ?? user.id).replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${user.id.slice(0, 8)}`;
  const { data: org, error: orgErr } = await orgsTable
    .insert({ name, slug })
    .select("id, webhook_token")
    .single();
  if (orgErr || !org) {
    throw new Error(orgErr?.message || "Could not create workspace");
  }

  const membersTable = (
    db as unknown as {
      schema: (name: string) => {
        from: (table: string) => {
          insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .schema("lead_scoring")
    .from("org_members");
  const { error: memberErr } = await membersTable.insert({
    user_id: user.id,
    org_id: org.id,
    role: "owner",
  });
  if (memberErr) {
    throw new Error(memberErr.message);
  }

  return { orgId: org.id, orgName: name, role: "owner", webhookToken: org.webhook_token };
}

/**
 * Updates branding fields on the caller's own org. Uses the service-role
 * client (see supabase-leads.ts note on RLS bypass) — the org_id filter here
 * is the real tenant boundary for this write, same as every other server
 * call in this app.
 */
export async function updateOrgBranding(
  orgId: string,
  patch: { logoUrl?: string; primaryColor?: string }
): Promise<void> {
  const db = getSupabase();
  if (!db) throw new Error("Supabase is not configured");
  const row: Record<string, unknown> = {};
  if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl || null;
  if (patch.primaryColor !== undefined) row.primary_color = patch.primaryColor || null;

  const table = (
    db as unknown as {
      schema: (name: string) => {
        from: (table: string) => {
          update: (row: Record<string, unknown>) => {
            eq: (col: string, value: string) => Promise<{ error: { message: string } | null }>;
          };
        };
      };
    }
  )
    .schema("lead_scoring")
    .from("organizations");
  const { error } = await table.update(row).eq("id", orgId);
  if (error) throw new Error(error.message);
}

/** Wraps a route handler body: resolves orgId, or returns the 401 for OrgScopeError. */
export async function withOrgScope<T>(
  fn: (orgId: string | undefined) => Promise<T>
): Promise<T | Response> {
  try {
    const orgId = await resolveOrgScope();
    return await fn(orgId);
  } catch (err) {
    if (err instanceof OrgScopeError) {
      return Response.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
}

/**
 * Handles a chat-approve click (`?t=<signed action token>`) for one lead
 * route. Slack/Teams clicks have no browser session, so this bypasses
 * withOrgScope/resolveOrgScope entirely and trusts the token's own orgId —
 * that's the whole point of signing it. Returns:
 *  - `{ orgId }` when the token is valid, matches leadId/action, and the
 *    caller should proceed with that orgId.
 *  - a plain-text Response (never JSON — a human is reading this on a phone
 *    from a Slack notification) when the token is missing, malformed,
 *    tampered, expired, or scoped to a different lead/action.
 */
export function checkActionToken(
  req: Request,
  leadId: string,
  action: LeadAction
): { orgId: string } | Response | null {
  const t = new URL(req.url).searchParams.get("t")?.trim();
  if (!t) return null;

  const result = verifyActionToken(t);
  if (!result.ok) {
    if (result.reason === "expired") {
      return new Response(
        "This approval link expired. Ask ops to resend it from the dashboard.",
        { status: 410, headers: { "Content-Type": "text/plain" } }
      );
    }
    return new Response("This link isn't valid.", {
      status: 401,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (result.payload.leadId !== leadId || result.payload.action !== action) {
    return new Response("This link isn't valid for this lead or action.", {
      status: 401,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return { orgId: result.payload.orgId };
}

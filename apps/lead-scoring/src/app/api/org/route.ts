import {
  anonSupabaseConfigured,
  authedUser,
  bootstrapOrgForUser,
  currentOrg,
  requireOrgScope,
  updateOrgBranding,
} from "@/lib/org-auth";

export const runtime = "nodejs";

export async function GET() {
  const configured = anonSupabaseConfigured();
  if (!configured) return Response.json({ configured: false, signedIn: false, org: null });
  const user = await authedUser();
  if (!user) return Response.json({ configured: true, signedIn: false, org: null });
  const org = await currentOrg(user.id);
  return Response.json({ configured: true, signedIn: true, user, org });
}

export async function POST() {
  const user = await authedUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const org = await bootstrapOrgForUser(user);
  return Response.json({ signedIn: true, user, org });
}

export async function PATCH(req: Request) {
  const scope = await requireOrgScope();
  if (!scope) return Response.json({ error: "Sign in and join a workspace first." }, { status: 401 });
  if (scope.org.role === "viewer") {
    return Response.json({ error: "Viewers cannot edit workspace branding." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { logoUrl, primaryColor } = body as { logoUrl?: string; primaryColor?: string };
  await updateOrgBranding(scope.org.orgId, { logoUrl, primaryColor });
  const org = await currentOrg(scope.user.id);
  return Response.json({ signedIn: true, user: scope.user, org });
}

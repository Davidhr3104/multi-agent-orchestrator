"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyDesk, postJson } from "@/components/notify-desk";
import { ROLE_LABEL } from "@/lib/access";
import type { ShellSession } from "@/lib/store";
import type { AccessRole, ApprovalMode, PlanId } from "@/lib/types";

const ROLES: AccessRole[] = ["owner", "manager", "creator", "client"];

export function TeamControls({ session }: { session: ShellSession }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  async function run(id: string, body: unknown, message: string) {
    setBusy(id);
    setError(null);
    try {
      await postJson("/api/workspace", body);
      notifyDesk(message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  const field = "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card/80 p-5">
        <h2 className="text-lg font-semibold text-foreground">Session role</h2>
        <p className="mt-1 text-xs text-muted-foreground">This desk has one signed-in session. Switching the role shows what that person can do. It does not invite anyone.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              aria-pressed={session.role === role}
              disabled={!!busy}
              onClick={() => void run("role", { action: "role", role }, `Acting as ${ROLE_LABEL[role]}.`)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${session.role === role ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
            >
              {ROLE_LABEL[role]}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-5">
        <h2 className="text-lg font-semibold text-foreground">Approval path</h2>
        <p className="mt-1 text-xs text-muted-foreground">Manager finishes the sign-off, or a manager signs off internally and the client approves. Creators never approve.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["manager", "Manager approves"],
              ["manager_then_client", "Manager, then client"],
            ] as [ApprovalMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={session.approval === mode}
              disabled={!!busy}
              onClick={() => void run("approval", { action: "approval", mode }, "Updated the approval path.")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${session.approval === mode ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-5">
        <h2 className="text-lg font-semibold text-foreground">Plan</h2>
        <p className="mt-1 text-sm text-foreground">
          {session.plan === "pro" ? "Pro" : "Starter"} · {session.creditsUsed}/{session.creditsLimit} AI credits · {session.accountLimit} connected accounts · {session.workspaces.length}/{session.workspaceLimit} workspaces
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Changing the plan updates these limits on the desk. No card is charged.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["starter", "pro"] as PlanId[]).map((plan) => (
            <button
              key={plan}
              type="button"
              aria-pressed={session.plan === plan}
              disabled={!!busy}
              onClick={() => void run("plan", { action: "plan", plan }, `Plan set to ${plan}.`)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${session.plan === plan ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
            >
              {plan}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-5">
        <h2 className="text-lg font-semibold text-foreground">New workspace</h2>
        <p className="mt-1 text-xs text-muted-foreground">A new brand starts with an empty calendar. Starter holds two workspaces; the demo already uses both until you move to Pro.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name" aria-label="New workspace name" />
          <button
            type="button"
            disabled={!!busy || !name.trim()}
            onClick={() => void run("create", { action: "create", name }, "Created the workspace and switched to it.")}
            className="inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
          >
            {busy === "create" ? "Creating…" : "Create workspace"}
          </button>
        </div>
      </section>
      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

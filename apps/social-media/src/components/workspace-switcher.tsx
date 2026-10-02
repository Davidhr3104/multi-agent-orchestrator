"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyDesk, postJson } from "@/components/notify-desk";
import type { ShellSession } from "@/lib/store";

export function WorkspaceSwitcher({ session }: { session: ShellSession }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function change(id: string) {
    if (id === session.workspaceId) return;
    setBusy(true);
    try {
      await postJson("/api/workspace", { action: "switch", id });
      notifyDesk("Switched workspace. Calendars, voice and connections stay separate.");
      router.refresh();
    } catch (err) {
      notifyDesk(err instanceof Error ? err.message : "Couldn't switch");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="block px-1">
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Workspace</span>
      <select
        aria-label="Workspace"
        disabled={busy}
        value={session.workspaceId}
        onChange={(e) => void change(e.target.value)}
        className="mt-1 w-full rounded-lg border border-sidebar-border bg-muted px-2 py-2 text-sm font-semibold text-foreground"
      >
        {session.workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
    </label>
  );
}

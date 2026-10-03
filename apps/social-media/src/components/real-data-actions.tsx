"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyDesk, postJson } from "@/components/notify-desk";
import { OperatorText } from "@/components/operator-text";

type Action = "refresh" | "drafts" | "weekly_report";

const LABEL: Record<Action, [string, string]> = {
  refresh: ["Refresh from Meta", "Reading…"],
  drafts: ["Draft from top posts", "Claude is drafting…"],
  weekly_report: ["Write weekly report", "Claude is writing…"],
};

export function RealDataActions({ claude }: { claude: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    setBusy(action);
    setError(null);
    try {
      const data = await postJson<{ message: string; ids?: string[] }>("/api/social", { action });
      notifyDesk(data.message, data.ids ?? []);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  const btn = "inline-flex min-h-9 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LABEL) as Action[]).map((action) => (
          <button
            key={action}
            type="button"
            disabled={!!busy || (action !== "refresh" && !claude)}
            onClick={() => void run(action)}
            className={`${btn} ${action === "drafts" ? "bg-primary text-primary-foreground hover:brightness-110" : "border border-border text-foreground hover:bg-accent"}`}
          >
            {busy === action ? LABEL[action][1] : LABEL[action][0]}
          </button>
        ))}
      </div>
      {!claude ? <p className="text-xs text-muted-foreground">Drafts and the weekly report need ANTHROPIC_API_KEY on this deployment.</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          <OperatorText text={error} />
        </p>
      ) : null}
    </div>
  );
}

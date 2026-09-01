"use client";

import { useCallback, useEffect, useState } from "react";
import { LogStream } from "@/components/log-stream";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { PipelineLog } from "@/lib/types";
import { cn } from "@/lib/utils";

type RunSummary = { runId: string; lastTs: string; count: number };

async function fetchRuns(): Promise<{
  configured: boolean;
  runs: RunSummary[];
}> {
  const res = await fetch("/api/logs");
  const data = await res.json();
  return { configured: Boolean(data.configured), runs: data.runs ?? [] };
}

async function fetchLogsForRun(runId: string): Promise<PipelineLog[]> {
  const res = await fetch(`/api/logs?runId=${encodeURIComponent(runId)}`);
  const data = await res.json();
  return data.logs ?? [];
}

export function LogsClient() {
  const { t } = useLanguage();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    fetchRuns().then(({ configured: isConfigured, runs: nextRuns }) => {
      if (!active) return;
      setConfigured(isConfigured);
      setRuns(nextRuns);
      setSelected((prev) => prev ?? nextRuns[0]?.runId ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    fetchLogsForRun(selected).then((nextLogs) => {
      if (active) setLogs(nextLogs);
    });
    return () => {
      active = false;
    };
  }, [selected]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchRuns()
      .then(({ configured: isConfigured, runs: nextRuns }) => {
        setConfigured(isConfigured);
        setRuns(nextRuns);
        setSelected((prev) => prev ?? nextRuns[0]?.runId ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (configured === null) {
    return (
      <p className="text-on-surface-variant text-sm">
        {t("logsClient.loading")}
      </p>
    );
  }

  if (!configured) {
    return (
      <div className="border-outline-variant/30 rounded-lg border border-dashed px-6 py-16 text-center">
        <p className="text-on-surface text-base font-medium">
          {t("logsClient.disabledTitle")}
        </p>
        <p className="text-on-surface-variant mx-auto mt-2 max-w-md text-sm leading-6">
          {t("logsClient.disabledDesc")}
        </p>
      </div>
    );
  }

  if (!runs.length) {
    return (
      <div className="border-outline-variant/30 rounded-lg border border-dashed px-6 py-16 text-center">
        <p className="text-on-surface text-base font-medium">
          {t("logsClient.noRunsTitle")}
        </p>
        <p className="text-on-surface-variant mx-auto mt-2 max-w-md text-sm leading-6">
          {t("logsClient.noRunsDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {runs.map((run) => (
            <button
              key={run.runId}
              type="button"
              onClick={() => setSelected(run.runId)}
              className={cn(
                "font-code-md rounded-full border px-3 py-1 text-[11px] transition-colors",
                selected === run.runId
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-outline-variant/30 text-on-surface-variant hover:text-on-surface"
              )}
            >
              {run.runId} · {run.count}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="font-label-sm text-on-surface-variant hover:text-primary text-[12px] underline disabled:opacity-50"
        >
          {t("logsClient.refresh")}
        </button>
      </div>
      <LogStream logs={logs} running={false} />
    </div>
  );
}

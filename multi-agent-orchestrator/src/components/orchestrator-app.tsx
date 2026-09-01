"use client";

import { useState } from "react";
import { AgentBoard } from "@/components/agent-board";
import { ControlPanel } from "@/components/control-panel";
import { ExportButtons } from "@/components/result-dashboard";
import { Icon } from "@/components/icon";
import { LogStream } from "@/components/log-stream";
import { PageFooter } from "@/components/page-footer";
import { ResultPanel } from "@/components/result-panel";
import { TopNav } from "@/components/top-nav";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEFAULT_ENABLED_AGENTS,
  DEFAULT_HITL_THRESHOLD,
  DEFAULT_MIN_CONFIDENCE,
} from "@/lib/config";
import { useLanguage } from "@/lib/i18n/language-provider";
import { AGENT_CATALOG, DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { SAMPLE_ARTICLE } from "@/lib/sample";
import { looksLikeUrl } from "@/lib/text";
import type {
  AgentEnabledMap,
  AgentRun,
  PermissionMap,
  PipelineLog,
  PipelineResult,
  StreamEvent,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export function OrchestratorApp() {
  const { t } = useLanguage();
  const [text, setText] = useState(SAMPLE_ARTICLE);
  const [url, setUrl] = useState("");
  const [permissions] = useState<PermissionMap>(DEFAULT_PERMISSIONS);
  const [enabledAgents, setEnabledAgents] =
    useState<AgentEnabledMap>(DEFAULT_ENABLED_AGENTS);
  const [minConfidence, setMinConfidence] = useState(DEFAULT_MIN_CONFIDENCE);
  const [hitlThreshold, setHitlThreshold] = useState(DEFAULT_HITL_THRESHOLD);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState("timeline");

  async function analyze() {
    setRunning(true);
    setError(null);
    setLogs([]);
    setRuns([]);
    setResult(null);
    setTab("timeline");

    const trimmedUrl = url.trim() || (looksLikeUrl(text) ? text.trim() : "");
    const payload = {
      ...(trimmedUrl
        ? { text: "", url: trimmedUrl }
        : { text, url: undefined }),
      permissions,
      enabledAgents,
      minConfidence,
      hitlThreshold,
    };

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim())
            .join("");
          if (!line) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "log") {
            setLogs((prev) => [...prev, event.log]);
          } else if (event.type === "agent") {
            setRuns((prev) => {
              const next = prev.filter((r) => r.agent !== event.run.agent);
              return [...next, event.run];
            });
          } else if (event.type === "result") {
            setResult(event.result);
            setTab("result");
          } else if (event.type === "error") {
            setError(event.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const runFor = (id: string) => runs.find((r) => r.agent === id);

  return (
    <div className="text-on-surface font-body-md flex min-h-full flex-col">
      <TopNav
        active="dashboard"
        pulse={running ? "busy" : "ok"}
        actions={
          <>
            <Sheet>
              <SheetTrigger className="border-outline-variant bg-surface-container-low text-on-surface hover:border-primary hover:text-primary font-label-sm rounded border px-3 py-1.5 text-[12px] transition-colors">
                <span className="flex items-center gap-1.5">
                  <Icon name="tune" className="text-[16px]" />
                  {t("nav.permissions")}
                </span>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-full overflow-y-auto data-[side=right]:sm:max-w-md"
              >
                <SheetHeader>
                  <SheetTitle>{t("dashboard.sheetTitle")}</SheetTitle>
                  <SheetDescription>
                    {t("dashboard.sheetDesc")}
                  </SheetDescription>
                </SheetHeader>
                <div className="px-4 pb-6">
                  <ControlPanel
                    enabled={enabledAgents}
                    onEnabled={setEnabledAgents}
                    minConfidence={minConfidence}
                    hitlThreshold={hitlThreshold}
                    onMinConfidence={setMinConfidence}
                    onHitlThreshold={setHitlThreshold}
                  />
                </div>
              </SheetContent>
            </Sheet>
            <button
              type="button"
              onClick={analyze}
              disabled={running}
              className="bg-primary text-on-primary hover:glow-primary font-label-sm flex items-center gap-2 rounded px-3 py-1.5 text-[12px] font-bold transition-all disabled:opacity-50"
            >
              <Icon name="play_arrow" filled className="text-[16px]" />
              {running ? t("nav.running") : t("nav.run")}
            </button>
          </>
        }
      />

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-8 px-4 py-8 pt-24 sm:px-6">
        {/* Hero */}
        <section className="flex flex-col gap-4">
          <div>
            <p className="text-primary glow-text-primary mb-2 text-[12px] uppercase tracking-widest">
              {running ? t("dashboard.kickerRunning") : t("dashboard.kicker")}
            </p>
            <h1 className="bg-gradient-to-r from-[#9aefff] to-[#4cd7f6] bg-clip-text text-[32px] font-bold leading-10 text-transparent sm:text-[40px] sm:leading-[48px]">
              {t("dashboard.title1")}
              <br />
              {t("dashboard.title2")}
            </h1>
          </div>

          {/* Stepper */}
          <div className="mt-2 flex w-full items-center gap-1 overflow-x-auto py-2">
            {AGENT_CATALOG.map((agent, i) => {
              const run = runFor(agent.id);
              const status = run?.status ?? "idle";
              const isActive = status === "running" || status === "done";
              return (
                <div key={agent.id} className="flex items-center">
                  <div
                    className={cn(
                      "relative z-10 flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px]",
                      status === "running" &&
                        "glow-primary border-primary bg-primary/20 text-primary border",
                      status === "done" &&
                        "border-tertiary bg-surface-container-high text-tertiary border",
                      status === "idle" &&
                        "border-outline-variant bg-surface-container-high text-on-surface border",
                      (status === "skipped" || status === "blocked") &&
                        "border-outline-variant bg-surface-container-high text-on-surface-variant border opacity-60"
                    )}
                  >
                    <Icon name={agent.icon} className="text-[14px]" />
                    {agent.short}
                  </div>
                  {i < AGENT_CATALOG.length - 1 ? (
                    <div
                      className={cn(
                        "-ml-1 h-px w-8",
                        isActive ? "bg-primary/60" : "bg-outline-variant/40"
                      )}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* Input + Console */}
        <section className="grid h-auto grid-cols-1 gap-6 lg:h-[480px] lg:grid-cols-12">
          <div className="border-surface-bright bg-surface-container relative flex flex-col gap-2 overflow-hidden rounded-lg border p-4 lg:col-span-7">
            <div className="via-primary/30 absolute top-0 right-0 left-0 h-[1px] bg-gradient-to-r from-transparent to-transparent" />
            <label className="text-on-surface-variant font-label-sm flex items-center gap-2 text-[12px]">
              <Icon name="link" className="text-[16px]" />
              {t("dashboard.urlLabel")}
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("dashboard.urlPlaceholder")}
              type="text"
              className="border-outline-variant bg-surface-container-lowest text-on-surface focus:border-primary focus:ring-primary font-code-md rounded border px-3 py-2 text-[14px] transition-all focus:outline-none focus:ring-1"
            />
            <label className="text-on-surface-variant font-label-sm mt-2 flex items-center gap-2 text-[12px]">
              <Icon name="description" className="text-[16px]" />
              {t("dashboard.contentLabel")}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("dashboard.contentPlaceholder")}
              className="border-outline-variant bg-surface-container-lowest text-on-surface focus:border-primary focus:ring-primary font-code-md min-h-[220px] flex-1 resize-none rounded border px-3 py-2.5 text-[14px] transition-all focus:outline-none focus:ring-1"
            />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setText(SAMPLE_ARTICLE);
                  setUrl("");
                }}
                className="text-on-surface-variant hover:text-primary font-label-sm text-[11px] underline"
              >
                {t("dashboard.restoreSample")}
              </button>
              {error ? (
                <p className="text-error text-[12px]" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </div>

          <div className="h-full min-h-[400px] lg:col-span-5">
            <LogStream logs={logs} running={running} />
          </div>
        </section>

        {/* Agent Board */}
        <section className="flex flex-col gap-3">
          <h2 className="text-on-surface flex items-center gap-2 text-[24px] font-semibold">
            <Icon name="group_work" className="text-primary text-[24px]" />
            {t("dashboard.agentMeshTitle")}
          </h2>
          <AgentBoard runs={runs} />
        </section>

        {/* Results */}
        <section className="bg-surface-container-low border-outline-variant/30 mt-2 flex flex-col overflow-hidden rounded-xl border">
          <Tabs value={tab} onValueChange={setTab}>
            <div className="border-outline-variant/30 bg-surface/50 flex items-center border-b">
              <TabsList className="bg-transparent p-0">
                <TabsTrigger value="timeline">
                  {t("dashboard.tabTimeline")}
                </TabsTrigger>
                <TabsTrigger value="result">
                  {t("dashboard.tabResult")}
                </TabsTrigger>
              </TabsList>
              <div className="flex-1" />
              {result ? (
                <div className="px-4">
                  <ExportButtons result={result} onPdfError={setError} />
                </div>
              ) : null}
            </div>

            <div className="p-4 sm:p-6">
              <TabsContent value="timeline">
                {logs.length ? (
                  <LogStream logs={logs} running={running} />
                ) : (
                  <EmptyState
                    title={t("dashboard.emptyTimelineTitle")}
                    description={t("dashboard.emptyTimelineDesc")}
                  />
                )}
              </TabsContent>
              <TabsContent value="result">
                {result ? (
                  <ResultPanel result={result} />
                ) : (
                  <EmptyState
                    title={t("dashboard.emptyResultTitle")}
                    description={t("dashboard.emptyResultDesc")}
                  />
                )}
              </TabsContent>
            </div>
          </Tabs>
        </section>
      </main>

      <PageFooter />
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-outline-variant/30 rounded-lg border border-dashed px-6 py-16 text-center">
      <p className="text-on-surface text-base font-medium">{title}</p>
      <p className="text-on-surface-variant mx-auto mt-2 max-w-md text-sm leading-6">
        {description}
      </p>
    </div>
  );
}

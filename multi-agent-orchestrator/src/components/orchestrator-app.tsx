"use client";

import { useState } from "react";
import { AgentBoard } from "@/components/agent-board";
import { ControlPanel } from "@/components/control-panel";
import { LogStream } from "@/components/log-stream";
import { ResultPanel } from "@/components/result-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_ENABLED_AGENTS,
  DEFAULT_HITL_THRESHOLD,
  DEFAULT_MIN_CONFIDENCE,
} from "@/lib/config";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions";
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
import { Shield, Sparkles, TerminalSquare } from "lucide-react";

export function OrchestratorApp() {
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
  const [tab, setTab] = useState("console");

  async function analyze() {
    setRunning(true);
    setError(null);
    setLogs([]);
    setRuns([]);
    setResult(null);
    setTab("console");

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

  return (
    <div className="helix-grid min-h-full">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#10192c]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-cyan-400/15 font-mono text-xs font-bold text-cyan-200 ring-1 ring-cyan-300/30">
              HX
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">Helix Orchestrator</p>
              <p className="text-muted-foreground text-[11px]">
                Multi-agent · audit log · HITL
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/70 sm:flex">
              <span
                className={`size-1.5 rounded-full ${running ? "helix-scan bg-cyan-300" : "bg-emerald-400"}`}
              />
              {running ? "pipeline activo" : "listo"}
            </span>
            <Sheet>
              <SheetTrigger
                render={<Button variant="outline" size="sm" />}
              >
                <Shield data-icon="inline-start" />
                Permisos
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-full overflow-y-auto data-[side=right]:sm:max-w-3xl"
              >
                <SheetHeader>
                  <SheetTitle>Permisos y umbrales</SheetTitle>
                  <SheetDescription>
                    Activa o apaga cada agente. Confianza mínima 0.70 y HITL
                    0.85 por defecto.
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
            <Button size="sm" onClick={analyze} disabled={running}>
              <Sparkles data-icon="inline-start" />
              {running ? "Orquestando…" : "Correr pipeline"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#15233d]/70 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.25)] sm:p-7">
          <p className="text-[11px] font-medium tracking-[0.22em] text-cyan-200/80 uppercase">
            Proyecto #1 · análisis de contenido
          </p>
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Seis agentes, un orquestador, cero cajas negras.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6 sm:text-base">
            Extrae con evidencia, puntúa SEO, verifica claims sin inventar
            fuentes y recomienda acciones. El revisor audita a sus pares. Si
            la confianza baja, entra un humano.
          </p>
          <ol className="mt-5 flex flex-wrap gap-2 text-[11px] text-white/70">
            {[
              "1. Input",
              "2. Extractor",
              "3. SEO ∥ Facts",
              "4. Reviewer",
              "5. Recs",
              "6. HITL",
            ].map((step) => (
              <li
                key={step}
                className="rounded-full border border-white/10 bg-white/4 px-3 py-1"
              >
                {step}
              </li>
            ))}
          </ol>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <Label htmlFor="content" className="text-sm">
                Brief o artículo
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  setText(SAMPLE_ARTICLE);
                  setUrl("");
                }}
              >
                Restaurar ejemplo
              </Button>
            </div>
            <Textarea
              id="content"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[240px] bg-black/30 font-mono text-[13px] leading-6"
            />
            <div className="mt-3 space-y-2">
              <Label htmlFor="url">URL pública (opcional, reemplaza el texto)</Label>
              <Input
                id="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-black/30"
              />
            </div>
            {error ? (
              <p className="text-destructive mt-3 text-sm" role="alert">
                {error}
              </p>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <TerminalSquare className="size-4 text-cyan-300" />
              <h2 className="text-sm font-medium">Consola en vivo</h2>
            </div>
            <LogStream logs={logs} />
            <p className="text-muted-foreground text-xs">
              Tip: en Permisos apaga Verificación y sube el umbral HITL. El
              log SSE debe mostrar skip + campos con evidencia.
            </p>
          </section>
        </div>

        <section className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-medium">Panel de permisos</h2>
          <ControlPanel
            enabled={enabledAgents}
            onEnabled={setEnabledAgents}
            minConfidence={minConfidence}
            hitlThreshold={hitlThreshold}
            onMinConfidence={setMinConfidence}
            onHitlThreshold={setHitlThreshold}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium">Grafo de agentes</h2>
          <AgentBoard runs={runs} />
        </section>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="console">Timeline</TabsTrigger>
            <TabsTrigger value="result">Resultado</TabsTrigger>
          </TabsList>
          <TabsContent value="console" className="pt-4">
            {logs.length ? (
              <LogStream logs={logs} />
            ) : (
              <div className="rounded-2xl border border-dashed border-white/12 px-6 py-16 text-center">
                <p className="text-base font-medium">Todavía no hay corrida</p>
                <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-6">
                  Pulsa <span className="text-foreground">Correr pipeline</span>{" "}
                  para ver extracción, SEO, verificación y el checkpoint
                  humano con confidence por campo.
                </p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="result" className="pt-4">
            {result ? (
              <ResultPanel result={result} />
            ) : (
              <div className="rounded-2xl border border-dashed border-white/12 px-6 py-16 text-center">
                <p className="text-base font-medium">Sin paquete consolidado</p>
                <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-6">
                  El orquestador llena esta vista cuando termina: campos,
                  claims, reviews y firma humana.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

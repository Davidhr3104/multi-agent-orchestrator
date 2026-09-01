"use client";

import { useState } from "react";
import { AgentBoard } from "@/components/agent-board";
import { LogStream } from "@/components/log-stream";
import { PermissionMatrix } from "@/components/permission-matrix";
import { ResultPanel } from "@/components/result-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { SAMPLE_ARTICLE } from "@/lib/sample";
import { looksLikeUrl } from "@/lib/text";
import type {
  AgentRun,
  PermissionMap,
  PipelineLog,
  PipelineResult,
  StreamEvent,
} from "@/lib/types";

export function OrchestratorApp() {
  const [text, setText] = useState(SAMPLE_ARTICLE);
  const [url, setUrl] = useState("");
  const [permissions, setPermissions] =
    useState<PermissionMap>(DEFAULT_PERMISSIONS);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function analyze() {
    setRunning(true);
    setError(null);
    setLogs([]);
    setRuns([]);
    setResult(null);

    const trimmedUrl = url.trim() || (looksLikeUrl(text) ? text.trim() : "");
    const payload = trimmedUrl
      ? { text: "", url: trimmedUrl, permissions }
      : { text, url: undefined, permissions };

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
          Proyecto #1 · Multi-Agent Orchestration
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Helix Orchestrator
        </h1>
        <p className="text-muted-foreground max-w-3xl text-base leading-7">
          Sistema de análisis de contenido con cuatro agentes especializados,
          un orquestador que elige el flujo, revisión cruzada, permisos
          granulares y logs auditables. Reutiliza patrones ya demostrados:
          confidence scoring, RAG honesto, Hermes (números determinísticos) y
          human-in-the-loop.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Label htmlFor="content">Texto o artículo</Label>
          <Textarea
            id="content"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[220px]"
          />
          <div className="space-y-2">
            <Label htmlFor="url">URL pública (opcional)</Label>
            <Input
              id="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={analyze} disabled={running}>
              {running ? "Orquestando…" : "Correr pipeline"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setText(SAMPLE_ARTICLE);
                setUrl("");
              }}
            >
              Restaurar ejemplo
            </Button>
          </div>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Permisos por agente</h2>
          <p className="text-muted-foreground text-sm">
            Desactiva un permiso para ver cómo el orquestador salta o bloquea
            al agente en los logs.
          </p>
        </div>
      </section>

      <PermissionMatrix value={permissions} onChange={setPermissions} />

      <AgentBoard runs={runs} />

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">Logs transparentes</TabsTrigger>
          <TabsTrigger value="result">Resultado</TabsTrigger>
        </TabsList>
        <TabsContent value="logs" className="pt-4">
          <LogStream logs={logs} />
        </TabsContent>
        <TabsContent value="result" className="pt-4">
          {result ? (
            <ResultPanel result={result} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Corre el pipeline para ver campos, claims, reviews y el
              checkpoint humano.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

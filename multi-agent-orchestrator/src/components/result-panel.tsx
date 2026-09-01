"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import type { PipelineResult, ScoredField } from "@/lib/types";
import { cn } from "@/lib/utils";

function confidenceTone(value: number): string {
  if (value >= 0.8) return "text-emerald-300";
  if (value >= 0.7) return "text-cyan-300";
  return "text-amber-300";
}

function FieldRow({
  field,
  approved,
  onToggle,
}: {
  field: ScoredField;
  approved: boolean;
  onToggle: (key: string, next: boolean) => void;
}) {
  return (
    <article className="rounded-xl border border-white/8 bg-white/4 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{field.label}</h4>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-xs", confidenceTone(field.confidence))}>
            {Math.round(field.confidence * 100)}%
          </span>
          {field.needsHuman ? (
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={approved}
                onCheckedChange={(state) => onToggle(field.key, state === true)}
              />
              Confirmar
            </label>
          ) : (
            <span className="text-muted-foreground text-[11px]">auto-ok</span>
          )}
        </div>
      </div>
      <p className="text-sm leading-6">{field.value}</p>
      <p className="text-muted-foreground mt-2 text-xs leading-5">
        Evidencia: {field.evidence}
      </p>
      <Progress className="mt-3" value={Math.round(field.confidence * 100)} />
    </article>
  );
}

export function ResultPanel({ result }: { result: PipelineResult }) {
  const humanFields = useMemo(
    () => result.fields.filter((f) => f.needsHuman),
    [result.fields]
  );
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [signedOff, setSignedOff] = useState(false);

  const allApproved =
    humanFields.length === 0 || humanFields.every((f) => approved[f.key]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Tipo de input" value={result.inputKind} />
        <Stat
          label="Confianza global"
          value={`${Math.round(result.overallConfidence * 100)}%`}
          hint={confidenceTone(result.overallConfidence)}
        />
        <Stat
          label="Checkpoint"
          value={result.humanRequired ? "humano requerido" : "auto-publicado no"}
        />
      </div>
      <Progress value={Math.round(result.overallConfidence * 100)} />
      {result.sourceUrl ? (
        <p className="text-muted-foreground text-xs break-all">
          Fuente: {result.sourceUrl}
        </p>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold tracking-wide text-white/80 uppercase">
          Campos extraídos
        </h3>
        <div className="grid gap-3 lg:grid-cols-2">
          {result.fields.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              approved={!!approved[field.key]}
              onToggle={(key, next) =>
                setApproved((prev) => ({ ...prev, [key]: next }))
              }
            />
          ))}
        </div>
      </section>

      {result.claims.length ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold tracking-wide text-white/80 uppercase">
            Claims
          </h3>
          <div className="space-y-2">
            {result.claims.map((claim, i) => (
              <div key={i} className="rounded-xl border border-white/8 bg-black/20 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      claim.status === "supported"
                        ? "default"
                        : claim.status === "conflicted"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {claim.status}
                  </Badge>
                  <span className="font-mono text-[11px] text-white/50">
                    {Math.round(claim.confidence * 100)}%
                  </span>
                </div>
                <p className="text-sm leading-6">{claim.text}</p>
                <p className="text-muted-foreground mt-1 text-xs">{claim.note}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {result.recommendations.length ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold tracking-wide text-white/80 uppercase">
            Recomendaciones
          </h3>
          <ol className="grid gap-3 md:grid-cols-2">
            {result.recommendations.map((rec, index) => (
              <li key={rec.title} className="rounded-xl border border-white/8 bg-white/4 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-xs text-cyan-300">
                    0{index + 1}
                  </span>
                  <Badge variant="outline">{rec.priority}</Badge>
                </div>
                <p className="text-sm font-medium">{rec.title}</p>
                <p className="text-muted-foreground mt-1 text-sm leading-6">
                  {rec.detail}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {result.reviews.length ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold tracking-wide text-white/80 uppercase">
            Revisión entre agentes
          </h3>
          <ul className="space-y-2">
            {result.reviews.map((note, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-white/8 px-4 py-3 text-sm">
                <Badge
                  variant={
                    note.verdict === "block"
                      ? "destructive"
                      : note.verdict === "revise"
                        ? "secondary"
                        : "default"
                  }
                >
                  {note.verdict}
                </Badge>
                <span>
                  <span className="font-medium">{note.targetAgent}: </span>
                  {note.comment}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.humanRequired ? (
        <section className="rounded-2xl border border-amber-400/25 bg-amber-400/8 p-5">
          <p className="text-sm font-medium text-amber-100">Checkpoint humano</p>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-6">
            Confirma los campos de baja confianza. Helix no publica a ciegas.
          </p>
          <Button
            className="mt-4"
            disabled={!allApproved}
            type="button"
            onClick={() => setSignedOff(true)}
          >
            {signedOff
              ? "Paquete firmado"
              : allApproved
                ? "Firmar paquete"
                : `Faltan ${humanFields.filter((f) => !approved[f.key]).length} confirmaciones`}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-3">
      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
        {label}
      </p>
      <p className={cn("mt-1 text-lg font-medium capitalize", hint)}>{value}</p>
    </div>
  );
}

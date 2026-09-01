"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { ResultDashboard } from "@/components/result-dashboard";
import type { PipelineResult, ScoredField } from "@/lib/types";
import { cn } from "@/lib/utils";

function confidenceTone(value: number): string {
  if (value >= 0.8) return "text-tertiary";
  if (value >= 0.7) return "text-primary";
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
  const [open, setOpen] = useState(field.needsHuman);

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded border p-3",
        field.needsHuman
          ? "border-[#d97706]/40 bg-surface-container"
          : "border-outline-variant/30 bg-surface-container"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="font-code-md text-secondary text-[13px]">
            {field.key}
          </span>
          {field.needsHuman ? (
            <span className="rounded bg-[#d97706]/20 px-1 text-[9px] font-bold uppercase text-[#d97706]">
              Review
            </span>
          ) : (
            <span className={cn("font-code-md text-[11px]", confidenceTone(field.confidence))}>
              {Math.round(field.confidence * 100)}%
            </span>
          )}
        </div>
        <Icon
          name={open ? "expand_less" : "expand_more"}
          className="text-outline group-hover:text-primary text-[18px]"
        />
      </button>

      {open ? (
        <div className="border-outline-variant/20 mt-2 flex flex-col gap-2 border-t pt-2">
          <span
            className={cn(
              "font-body-md inline-block w-fit rounded p-1 text-[14px]",
              field.needsHuman
                ? "bg-error/10 text-error"
                : "text-on-surface"
            )}
          >
            &quot;{field.value}&quot;
          </span>
          <p className="text-on-surface-variant text-xs leading-5">
            Evidencia: {field.evidence}
          </p>
          {field.needsHuman ? (
            <label className="mt-1 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => onToggle(field.key, e.target.checked)}
                className="text-[#d97706] focus:ring-0 border-outline-variant bg-surface rounded"
              />
              <span className="text-on-surface-variant font-label-sm">
                Aprobar este valor manualmente
              </span>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
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
      <ResultDashboard result={result} />
      {result.sourceUrl ? (
        <p className="text-on-surface-variant text-xs break-all">
          Fuente: {result.sourceUrl}
        </p>
      ) : null}

      {result.humanRequired ? (
        <div className="relative flex items-start gap-4 overflow-hidden rounded-lg border border-[#d97706]/50 bg-[#1a1500] p-4">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-[#d97706]" />
          <Icon name="warning" className="text-[24px] text-[#d97706]" />
          <div className="flex-1">
            <h4 className="text-[16px] font-bold text-[#fcd34d]">
              Intervención Humana Requerida (HITL)
            </h4>
            <p className="text-on-surface-variant mb-3 mt-1 text-[14px]">
              {humanFields.length} campo(s) por debajo del umbral. Confirma
              antes de tratar este paquete como publicable.
            </p>
            <button
              type="button"
              disabled={!allApproved}
              onClick={() => setSignedOff(true)}
              className={cn(
                "flex items-center gap-2 rounded px-4 py-2 text-[13px] font-bold transition-colors",
                allApproved
                  ? "bg-[#d97706] text-black hover:bg-[#f59e0b]"
                  : "bg-[#d97706]/30 text-black/60 cursor-not-allowed"
              )}
            >
              <Icon name="draw" className="text-[16px]" />
              {signedOff
                ? "Paquete firmado"
                : allApproved
                  ? "Firmar paquete"
                  : `Faltan ${humanFields.filter((f) => !approved[f.key]).length} confirmaciones`}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h3 className="border-outline-variant/30 text-primary border-b pb-2 text-[12px] uppercase tracking-widest">
            Campos Extraídos
          </h3>
          <div className="flex flex-col gap-2">
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
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="border-outline-variant/30 text-primary border-b pb-2 text-[12px] uppercase tracking-widest">
            Claims &amp; Notas
          </h3>
          <div className="flex flex-col gap-2">
            {result.claims.map((claim, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2 rounded p-2",
                  claim.status === "supported"
                    ? "bg-surface-container"
                    : "border-error/30 bg-surface-container border"
                )}
              >
                <Icon
                  name={claim.status === "supported" ? "verified" : "gpp_bad"}
                  className={cn(
                    "mt-0.5 text-[16px]",
                    claim.status === "supported" ? "text-tertiary" : "text-error"
                  )}
                />
                <div>
                  <p className="text-on-surface text-[13px]">{claim.text}</p>
                  <p
                    className={cn(
                      "font-code-md mt-0.5 text-[10px]",
                      claim.status === "supported"
                        ? "text-outline"
                        : "text-error/80"
                    )}
                  >
                    {claim.note} · confianza {Math.round(claim.confidence * 100)}%
                  </p>
                </div>
              </div>
            ))}
            {!result.claims.length ? (
              <p className="text-on-surface-variant text-xs">
                Sin claims: verificación deshabilitada o sin permisos.
              </p>
            ) : null}
          </div>

          {result.recommendations.length ? (
            <div className="mt-4 flex flex-col gap-2">
              <h4 className="text-on-surface-variant font-label-sm text-[11px] uppercase">
                Recomendaciones del Agente
              </h4>
              <ol className="text-on-surface-variant list-inside list-decimal space-y-1 text-[13px]">
                {result.recommendations.map((rec) => (
                  <li key={rec.title}>
                    <span className="text-on-surface font-medium">
                      {rec.title}.
                    </span>{" "}
                    {rec.detail}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {result.reviews.length ? (
            <div className="mt-4 flex flex-col gap-2">
              <h4 className="text-on-surface-variant font-label-sm text-[11px] uppercase">
                Revisión entre agentes
              </h4>
              <ul className="space-y-1.5">
                {result.reviews.map((note, i) => (
                  <li key={i} className="text-on-surface-variant text-[13px]">
                    <span
                      className={cn(
                        "mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        note.verdict === "approve" &&
                          "bg-tertiary/15 text-tertiary",
                        note.verdict === "revise" &&
                          "bg-amber-400/15 text-amber-200",
                        note.verdict === "block" && "bg-error/15 text-error"
                      )}
                    >
                      {note.verdict}
                    </span>
                    <span className="text-on-surface font-medium">
                      {note.targetAgent}:
                    </span>{" "}
                    {note.comment}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

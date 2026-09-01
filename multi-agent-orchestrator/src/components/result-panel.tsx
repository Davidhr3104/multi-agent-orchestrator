"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { PipelineResult, ScoredField } from "@/lib/types";

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
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{field.label}</p>
        <div className="flex items-center gap-2">
          <Badge variant={field.needsHuman ? "secondary" : "outline"}>
            conf {field.confidence.toFixed(2)}
          </Badge>
          {field.needsHuman ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={approved}
                onCheckedChange={(state) => onToggle(field.key, state === true)}
              />
              <span>Confirmar</span>
            </label>
          ) : (
            <span className="text-muted-foreground text-xs">auto-ok</span>
          )}
        </div>
      </div>
      <p>{field.value}</p>
      <p className="text-muted-foreground text-xs">
        Evidencia: {field.evidence}
      </p>
      <Progress value={Math.round(field.confidence * 100)} />
    </div>
  );
}

export function ResultPanel({ result }: { result: PipelineResult }) {
  const humanFields = useMemo(
    () => result.fields.filter((f) => f.needsHuman),
    [result.fields]
  );
  const [approved, setApproved] = useState<Record<string, boolean>>({});

  const allApproved =
    humanFields.length === 0 || humanFields.every((f) => approved[f.key]);

  return (
    <div className="space-y-6">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Consolidado del orquestador</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge>tipo {result.inputKind}</Badge>
            <Badge variant="outline">
              confianza global {result.overallConfidence.toFixed(2)}
            </Badge>
            <Badge variant={result.humanRequired ? "secondary" : "default"}>
              {result.humanRequired
                ? "requiere humano"
                : "sin checkpoint obligatorio"}
            </Badge>
          </div>
          <Progress value={Math.round(result.overallConfidence * 100)} />
          {result.sourceUrl ? (
            <p className="text-sm break-all">Fuente: {result.sourceUrl}</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Campos extraídos</h3>
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

      {result.claims.length ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Claims verificadas</h3>
          {result.claims.map((claim, i) => (
            <div key={i} className="space-y-1 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
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
                <span className="font-mono text-xs">
                  conf {claim.confidence.toFixed(2)}
                </span>
              </div>
              <p className="text-sm">{claim.text}</p>
              <p className="text-muted-foreground text-xs">{claim.note}</p>
            </div>
          ))}
        </div>
      ) : null}

      {result.recommendations.length ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Recomendaciones</h3>
          {result.recommendations.map((rec) => (
            <div key={rec.title} className="rounded-lg border p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <p className="font-medium">{rec.title}</p>
                <Badge variant="outline">{rec.priority}</Badge>
              </div>
              <p className="text-sm">{rec.detail}</p>
            </div>
          ))}
        </div>
      ) : null}

      {result.reviews.length ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Revisión entre agentes</h3>
          {result.reviews.map((note, i) => (
            <p key={i} className="text-sm">
              <Badge className="mr-2">{note.verdict}</Badge>
              <span className="font-medium">{note.targetAgent}:</span>{" "}
              {note.comment}
            </p>
          ))}
        </div>
      ) : null}

      {result.humanRequired ? (
        <div className="bg-muted/50 space-y-3 rounded-lg border p-4">
          <Label className="text-base">Checkpoint humano</Label>
          <p className="text-muted-foreground text-sm">
            Confirma los campos marcados antes de tratar este paquete como
            publicable. El orquestador no auto-aprueba confianza baja.
          </p>
          <Button disabled={!allApproved} type="button">
            {allApproved
              ? "Paquete aprobado por humano"
              : "Faltan confirmaciones"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { PageFooter } from "@/components/page-footer";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "Workflows · Helix Orchestrator",
};

type Step = {
  icon: string;
  title: string;
  detail: string;
  meta?: string;
  parallel?: boolean;
};

const STEPS: Step[] = [
  {
    icon: "route",
    title: "1. Clasificación",
    detail:
      "El orquestador decide si el input es url, article o copy (según longitud del texto o si llegó una URL) y arma el orden del grafo según ese tipo.",
    meta: "Orquestador",
  },
  {
    icon: "save_as",
    title: "2. Extracción",
    detail:
      "El extractor construye 5 campos (título, audiencia, keywords, tono, extensión), cada uno con su propio confidence score y una cita como evidencia.",
    meta: "Extractor",
  },
  {
    icon: "call_split",
    title: "3. SEO y Verificación en paralelo",
    detail:
      "SEO calcula legibilidad y densidad de keywords; Verificación separa afirmaciones en supported / unverified / conflicted. Corren al mismo tiempo y cada uno respeta sus propios permisos.",
    meta: "Calidad / SEO · Verificación",
    parallel: true,
  },
  {
    icon: "rule",
    title: "4. Revisión cruzada (pase 1)",
    detail:
      "El revisor evalúa extractor, SEO y verificación. Emite approve, revise o block por cada uno — agent-reviewing-agent.",
    meta: "Revisor cruzado",
  },
  {
    icon: "recommend",
    title: "5. Recomendaciones",
    detail:
      "El recomendador lee los outputs anteriores (nunca calcula sus propios números) y prioriza hasta 5 acciones en alta / media / baja prioridad.",
    meta: "Recomendaciones",
  },
  {
    icon: "rule",
    title: "6. Revisión cruzada (pase 2)",
    detail:
      "El revisor vuelve a correr, esta vez sobre el recomendador, y actualiza su resumen de decisiones.",
    meta: "Revisor cruzado",
  },
  {
    icon: "merge",
    title: "7. Consolidación",
    detail:
      "El orquestador promedia la confianza de los agentes que terminaron, decide si se requiere HITL (campo por debajo del umbral o confianza global baja) y narra el resultado con Claude si hay API key configurada.",
    meta: "Orquestador",
  },
];

const INPUT_KINDS = [
  {
    icon: "link",
    label: "url",
    detail:
      "Llega una URL pública. El orquestador hace fetch (si tiene el permiso fetch_url) y convierte el HTML a texto antes de seguir.",
  },
  {
    icon: "article",
    label: "article",
    detail:
      "Texto de 280+ caracteres sin URL. Flujo completo: SEO evalúa profundidad y estructura de H2/H3 implícita.",
  },
  {
    icon: "short_text",
    label: "copy",
    detail:
      "Texto corto (<280 caracteres). La audiencia se infiere como 'visitante de landing' y las recomendaciones priorizan el hook inicial.",
  },
];

export default function WorkflowsPage() {
  return (
    <div className="text-on-surface font-body-md flex min-h-full flex-col">
      <TopNav active="workflows" />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-10 px-4 py-8 pt-24 sm:px-6">
        <header>
          <p className="text-primary glow-text-primary mb-2 text-[12px] uppercase tracking-widest">
            Definición del pipeline
          </p>
          <h1 className="text-on-surface text-[32px] font-bold leading-10">
            Content Intelligence Pipeline
          </h1>
          <p className="text-on-surface-variant mt-2 max-w-2xl text-sm leading-6">
            Un único workflow, siete pasos, con una rama en paralelo y una
            revisión cruzada que corre dos veces. Los permisos y umbrales
            (confianza mínima 0.70, HITL 0.85 por defecto) se configuran en
            el Dashboard y afectan directamente qué pasos se saltan o
            bloquean.
          </p>
        </header>

        {/* Vertical step timeline */}
        <section className="flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={cnPrimaryBadge(step.parallel)}
                >
                  <Icon name={step.icon} className="text-[18px]" />
                </span>
                {i < STEPS.length - 1 ? (
                  <div className="bg-outline-variant/30 mt-1 w-px flex-1" />
                ) : null}
              </div>
              <div className="border-outline-variant/30 bg-surface-container mb-3 flex-1 rounded-lg border p-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-on-surface text-sm font-semibold">
                    {step.title}
                  </h3>
                  {step.meta ? (
                    <span className="font-code-md text-outline text-[10px] uppercase">
                      {step.meta}
                    </span>
                  ) : null}
                </div>
                <p className="text-on-surface-variant text-[13px] leading-5">
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* Input kinds */}
        <section className="flex flex-col gap-3">
          <h2 className="text-on-surface flex items-center gap-2 text-[20px] font-semibold">
            <Icon name="category" className="text-primary text-[20px]" />
            Tipos de input y cómo cambian el flujo
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {INPUT_KINDS.map((kind) => (
              <div
                key={kind.label}
                className="border-outline-variant/30 bg-surface-container flex flex-col gap-2 rounded-lg border p-4"
              >
                <div className="flex items-center gap-2">
                  <Icon name={kind.icon} className="text-primary text-[18px]" />
                  <span className="font-code-md text-secondary text-[13px]">
                    {kind.label}
                  </span>
                </div>
                <p className="text-on-surface-variant text-[13px] leading-5">
                  {kind.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Thresholds */}
        <section className="border-outline-variant/30 bg-surface-container-low flex flex-col gap-3 rounded-lg border p-5">
          <h2 className="text-on-surface flex items-center gap-2 text-[16px] font-semibold">
            <Icon name="tune" className="text-primary text-[18px]" />
            Umbrales que gobiernan las decisiones
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="font-code-md text-primary text-[13px]">
                Confianza mínima — 0.70
              </p>
              <p className="text-on-surface-variant mt-1 text-[13px] leading-5">
                Si un agente termina por debajo de este valor, su decisión
                pasa a &quot;bloqueado&quot; en el dashboard de resultados.
              </p>
            </div>
            <div>
              <p className="font-code-md text-[13px] text-[#fcd34d]">
                Umbral HITL — 0.85
              </p>
              <p className="text-on-surface-variant mt-1 text-[13px] leading-5">
                Por debajo de este valor, un campo queda marcado
                needsHuman y el paquete requiere firma humana antes de
                publicarse.
              </p>
            </div>
          </div>
        </section>

        <Link
          href="/"
          className="text-primary w-fit text-sm font-medium hover:underline"
        >
          ← Ir al Dashboard
        </Link>
      </main>
      <PageFooter />
    </div>
  );
}

function cnPrimaryBadge(parallel?: boolean) {
  return [
    "flex size-9 shrink-0 items-center justify-center rounded-full border",
    parallel
      ? "border-secondary bg-secondary/15 text-secondary"
      : "border-primary bg-primary/15 text-primary",
  ].join(" ");
}

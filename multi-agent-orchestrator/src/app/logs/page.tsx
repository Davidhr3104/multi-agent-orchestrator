import type { Metadata } from "next";
import Link from "next/link";
import { LogsClient } from "@/components/logs-client";
import { PageFooter } from "@/components/page-footer";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "Logs · Helix Orchestrator",
};

export default function LogsPage() {
  return (
    <div className="text-on-surface font-body-md flex min-h-full flex-col">
      <TopNav active="logs" />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-8 px-4 py-8 pt-24 sm:px-6">
        <header>
          <p className="text-primary glow-text-primary mb-2 text-[12px] uppercase tracking-widest">
            Auditoría
          </p>
          <h1 className="text-on-surface text-[32px] font-bold leading-10">
            Logs persistidos
          </h1>
          <p className="text-on-surface-variant mt-2 max-w-2xl text-sm leading-6">
            Cada corrida que pasa por Supabase queda aquí, agrupada por
            run_id, con timestamp, agente, campo, confidence y evidencia —
            exactamente lo que se ve en la consola en vivo del Dashboard,
            pero persistido.
          </p>
        </header>

        <LogsClient />

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

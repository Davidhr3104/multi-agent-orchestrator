"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ChartCard } from "@helix/ui";

type Mode = "demo" | "live" | null;
const DeskModeContext = createContext<Mode>(null);

/** Fetches the desk mode once and refreshes it when the AI drawer or Settings change the data. */
export function DeskModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(null);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/settings/desk");
        if (!res.ok) return;
        const data = (await res.json()) as { mode?: "demo" | "live" };
        if (alive) setMode(data.mode ?? null);
      } catch {
        if (alive) setMode(null);
      }
    }
    void load();
    const onRefresh = () => void load();
    window.addEventListener("helix:desk-refresh", onRefresh);
    return () => {
      alive = false;
      window.removeEventListener("helix:desk-refresh", onRefresh);
    };
  }, []);
  return <DeskModeContext.Provider value={mode}>{children}</DeskModeContext.Provider>;
}

export function useDeskMode(): Mode {
  return useContext(DeskModeContext);
}

/**
 * Chart frame in the desk's glass style. While the desk runs on the demo seed every chart carries a
 * "Demo data" chip; `illustrative` swaps it for "Illustrative". `source` is the one-line provenance.
 */
export function DeskChartCard({
  title,
  subtitle,
  source,
  illustrative,
  action,
  children,
  className = "",
  ...rest
}: {
  title: string;
  subtitle?: string;
  source?: string;
  illustrative?: boolean;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  "data-tour"?: string;
}) {
  const mode = useDeskMode();
  return (
    <div className={`glass-panel glass-panel-glow rounded-xl p-5 ${className}`} {...rest}>
      <ChartCard
        title={title}
        subtitle={subtitle}
        demo={mode === "demo"}
        illustrative={illustrative}
        source={source}
        action={action}
        style={{ border: "none", padding: 0, background: "transparent" }}
      >
        {children}
      </ChartCard>
    </div>
  );
}

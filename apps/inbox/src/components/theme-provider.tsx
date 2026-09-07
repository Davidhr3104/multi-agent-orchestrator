"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DeskTheme } from "@/lib/types";
import { THEME_STORAGE_KEY } from "@/lib/theme";

type ThemeContextValue = {
  theme: DeskTheme;
  setTheme: (theme: DeskTheme) => void;
  toggleTheme: () => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyDomTheme(theme: DeskTheme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<DeskTheme>("dark");
  const [ready, setReady] = useState(false);

  const persist = useCallback((next: DeskTheme) => {
    applyDomTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    void fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => undefined);
  }, []);

  const setTheme = useCallback(
    (next: DeskTheme) => {
      setThemeState(next);
      persist(next);
    },
    [persist]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      let initial: DeskTheme = "dark";
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === "light" || stored === "dark") initial = stored;
      } catch {
        /* ignore */
      }

      applyDomTheme(initial);
      if (!cancelled) {
        setThemeState(initial);
        setReady(true);
      }

      try {
        const res = await fetch("/api/preferences");
        if (!res.ok) return;
        const data = (await res.json()) as { preferences?: { theme?: DeskTheme } };
        const remote = data.preferences?.theme;
        if (!remote || (remote !== "light" && remote !== "dark")) return;
        const local = (() => {
          try {
            return localStorage.getItem(THEME_STORAGE_KEY);
          } catch {
            return null;
          }
        })();
        // Prefer localStorage when user already chose; otherwise hydrate from server.
        if (!local && remote !== initial && !cancelled) {
          setThemeState(remote);
          applyDomTheme(remote);
          try {
            localStorage.setItem(THEME_STORAGE_KEY, remote);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, ready }),
    [theme, setTheme, toggleTheme, ready]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { THEME_STORAGE_KEY, isDeskTheme, type DeskTheme } from "@/lib/theme";

type Value = { theme: DeskTheme; toggleTheme: () => void; ready: boolean };

const ThemeContext = createContext<Value | null>(null);

function apply(theme: DeskTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export const themeBootScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark')t='dark';var r=document.documentElement;if(t==='dark')r.classList.add('dark');else r.classList.remove('dark');r.dataset.theme=t;r.style.colorScheme=t;}catch(e){document.documentElement.classList.add('dark');}})();`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<DeskTheme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      const next: DeskTheme = isDeskTheme(stored) ? stored : "dark";
      setTheme(next);
      apply(next);
    } finally {
      setReady(true);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((cur) => {
      const next: DeskTheme = cur === "dark" ? "light" : "dark";
      apply(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme, ready }), [theme, toggleTheme, ready]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme requires ThemeProvider");
  return ctx;
}

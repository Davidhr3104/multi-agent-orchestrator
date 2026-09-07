"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "helix-commerce-theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      setThemeState(stored);
      applyTheme(stored);
      return;
    }
    // No local preference yet (new device/browser) — fall back to whatever was
    // last persisted server-side, so the choice follows the user across devices.
    void fetch("/api/preferences/theme")
      .then((res) => res.json())
      .then((data: { theme?: string }) => {
        const remote: Theme = data.theme === "light" ? "light" : "dark";
        setThemeState(remote);
        applyTheme(remote);
        localStorage.setItem(STORAGE_KEY, remote);
      })
      .catch(() => {
        applyTheme("dark");
      });
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    void fetch("/api/preferences/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {
      // Best-effort sync — localStorage already persisted the choice, so a failed
      // network write never leaves the user's toggle unresponsive or unsaved locally.
    });
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

/** Inline script string, injected before hydration to set the class synchronously and avoid a flash of the wrong theme. */
export const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var theme = stored === "light" ? "light" : "dark";
    var root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    root.style.colorScheme = theme;
  } catch (e) {}
})();
`;

"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_KEY } from "@/lib/theme";
import { cn } from "@/lib/utils";

const EVENT = "helix:theme";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const light = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(THEME_KEY) === "light",
    () => false
  );
  const toggle = () => {
    const next = light ? "dark" : "light";
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.classList.toggle("dark", next === "dark");
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      title={light ? "Dark mode" : "Light mode"}
      className={cn(
        "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg text-muted-foreground transition hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        !compact && "lg:w-auto lg:px-2.5 lg:text-xs lg:font-medium",
        className
      )}
    >
      {light ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
      {compact ? null : <span className="hidden lg:inline">{light ? "Dark" : "Light"}</span>}
    </button>
  );
}

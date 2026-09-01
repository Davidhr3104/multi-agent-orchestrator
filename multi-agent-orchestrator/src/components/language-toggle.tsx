"use client";

import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const { lang, setLang, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className="border-outline-variant/40 flex items-center rounded-full border p-0.5 text-[11px]"
    >
      {(["es", "en"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLang(option)}
          aria-pressed={lang === option}
          className={cn(
            "font-label-sm rounded-full px-2.5 py-1 uppercase tracking-wide transition-colors",
            lang === option
              ? "bg-primary text-on-primary"
              : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

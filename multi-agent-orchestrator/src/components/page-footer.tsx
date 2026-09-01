"use client";

import { useLanguage } from "@/lib/i18n/language-provider";

export function PageFooter() {
  const { t } = useLanguage();

  return (
    <footer className="border-outline-variant/20 bg-surface-dim mt-8 w-full border-t py-4">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
        <p className="text-on-surface-variant font-label-sm text-[12px]">
          {t("footer.version")}
        </p>
        <div className="flex gap-4">
          <span className="text-on-surface-variant hover:text-tertiary cursor-default text-[13px] underline">
            {t("footer.docs")}
          </span>
          <span className="text-on-surface-variant hover:text-tertiary cursor-default text-[13px] underline">
            {t("footer.support")}
          </span>
          <span className="text-on-surface-variant hover:text-tertiary cursor-default text-[13px] underline">
            {t("footer.status")}
          </span>
        </div>
      </div>
    </footer>
  );
}

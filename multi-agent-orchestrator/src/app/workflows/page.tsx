"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";
import { PageFooter } from "@/components/page-footer";
import { TopNav } from "@/components/top-nav";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

type StepKey = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const STEP_KEYS: { key: StepKey; icon: string; parallel?: boolean }[] = [
  { key: 1, icon: "route" },
  { key: 2, icon: "save_as" },
  { key: 3, icon: "call_split", parallel: true },
  { key: 4, icon: "rule" },
  { key: 5, icon: "recommend" },
  { key: 6, icon: "rule" },
  { key: 7, icon: "merge" },
];

const INPUT_KINDS: { key: "url" | "article" | "copy"; icon: string }[] = [
  { key: "url", icon: "link" },
  { key: "article", icon: "article" },
  { key: "copy", icon: "short_text" },
];

export default function WorkflowsPage() {
  const { t } = useLanguage();

  return (
    <div className="text-on-surface font-body-md flex min-h-full flex-col">
      <TopNav active="workflows" />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-10 px-4 py-8 pt-24 sm:px-6">
        <header>
          <p className="text-primary glow-text-primary mb-2 text-[12px] uppercase tracking-widest">
            {t("workflowsPage.kicker")}
          </p>
          <h1 className="text-on-surface text-[32px] font-bold leading-10">
            {t("workflowsPage.title")}
          </h1>
          <p className="text-on-surface-variant mt-2 max-w-2xl text-sm leading-6">
            {t("workflowsPage.subtitle")}
          </p>
        </header>

        {/* Vertical step timeline */}
        <section className="flex flex-col gap-3">
          {STEP_KEYS.map((step, i) => (
            <div key={step.key} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={cnPrimaryBadge(step.parallel)}
                >
                  <Icon name={step.icon} className="text-[18px]" />
                </span>
                {i < STEP_KEYS.length - 1 ? (
                  <div className="bg-outline-variant/30 mt-1 w-px flex-1" />
                ) : null}
              </div>
              <div className="border-outline-variant/30 bg-surface-container mb-3 flex-1 rounded-lg border p-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-on-surface text-sm font-semibold">
                    {t(`workflowsPage.step${step.key}.title` as TranslationKey)}
                  </h3>
                  <span className="font-code-md text-outline text-[10px] uppercase">
                    {t(`workflowsPage.step${step.key}.meta` as TranslationKey)}
                  </span>
                </div>
                <p className="text-on-surface-variant text-[13px] leading-5">
                  {t(`workflowsPage.step${step.key}.detail` as TranslationKey)}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* Input kinds */}
        <section className="flex flex-col gap-3">
          <h2 className="text-on-surface flex items-center gap-2 text-[20px] font-semibold">
            <Icon name="category" className="text-primary text-[20px]" />
            {t("workflowsPage.inputKindsTitle")}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {INPUT_KINDS.map((kind) => (
              <div
                key={kind.key}
                className="border-outline-variant/30 bg-surface-container flex flex-col gap-2 rounded-lg border p-4"
              >
                <div className="flex items-center gap-2">
                  <Icon name={kind.icon} className="text-primary text-[18px]" />
                  <span className="font-code-md text-secondary text-[13px]">
                    {t(`workflowsPage.kind.${kind.key}.label` as TranslationKey)}
                  </span>
                </div>
                <p className="text-on-surface-variant text-[13px] leading-5">
                  {t(`workflowsPage.kind.${kind.key}.detail` as TranslationKey)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Thresholds */}
        <section className="border-outline-variant/30 bg-surface-container-low flex flex-col gap-3 rounded-lg border p-5">
          <h2 className="text-on-surface flex items-center gap-2 text-[16px] font-semibold">
            <Icon name="tune" className="text-primary text-[18px]" />
            {t("workflowsPage.thresholdsTitle")}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="font-code-md text-primary text-[13px]">
                {t("workflowsPage.minConfTitle")}
              </p>
              <p className="text-on-surface-variant mt-1 text-[13px] leading-5">
                {t("workflowsPage.minConfDetail")}
              </p>
            </div>
            <div>
              <p className="font-code-md text-[13px] text-[#fcd34d]">
                {t("workflowsPage.hitlTitle")}
              </p>
              <p className="text-on-surface-variant mt-1 text-[13px] leading-5">
                {t("workflowsPage.hitlDetail")}
              </p>
            </div>
          </div>
        </section>

        <Link
          href="/"
          className="text-primary w-fit text-sm font-medium hover:underline"
        >
          {t("common.backToDashboard")}
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

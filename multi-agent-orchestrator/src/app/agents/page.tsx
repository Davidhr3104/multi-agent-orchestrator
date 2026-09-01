"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";
import { PageFooter } from "@/components/page-footer";
import { TopNav } from "@/components/top-nav";
import { useLanguage } from "@/lib/i18n/language-provider";
import { AGENT_CATALOG, DEFAULT_PERMISSIONS } from "@/lib/permissions";

export default function AgentsPage() {
  const { t } = useLanguage();

  return (
    <div className="text-on-surface font-body-md flex min-h-full flex-col">
      <TopNav active="agents" />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-8 px-4 py-8 pt-24 sm:px-6">
        <header>
          <p className="text-primary glow-text-primary mb-2 text-[12px] uppercase tracking-widest">
            {t("agentsPage.kicker")}
          </p>
          <h1 className="text-on-surface text-[32px] font-bold leading-10">
            {t("agentsPage.title")}
          </h1>
          <p className="text-on-surface-variant mt-2 max-w-2xl text-sm leading-6">
            {t("agentsPage.subtitle")}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {AGENT_CATALOG.map((agent) => {
            const perms = DEFAULT_PERMISSIONS[agent.id] ?? [];
            return (
              <article
                key={agent.id}
                className="border-outline-variant/30 bg-surface-container flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-primary/15 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <Icon name={agent.icon} className="text-[20px]" />
                  </span>
                  <div>
                    <p className="text-on-surface text-sm font-semibold">
                      {t(`agent.${agent.id}.name` as const)}
                    </p>
                    <p className="font-code-md text-outline text-[10px] uppercase">
                      {agent.short}
                    </p>
                  </div>
                </div>
                <p className="text-on-surface-variant text-[13px] leading-5">
                  {t(`agent.${agent.id}.detail` as const)}
                </p>
                <div className="border-outline-variant/20 mt-auto border-t pt-3">
                  <p className="text-on-surface-variant font-label-sm mb-2 text-[10px] uppercase tracking-wide">
                    {t("agentsPage.defaultPerms")}
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {perms.length ? (
                      perms.map((p) => (
                        <li
                          key={p}
                          className="border-outline-variant/30 text-on-surface-variant rounded-full border px-2 py-0.5 text-[11px]"
                        >
                          {t(`permission.${p}` as const)}
                        </li>
                      ))
                    ) : (
                      <li className="text-outline text-[11px]">
                        {t("agentsPage.noDefaultPerms")}
                      </li>
                    )}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>

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

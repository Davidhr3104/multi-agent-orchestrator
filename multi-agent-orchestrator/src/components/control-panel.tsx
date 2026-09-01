"use client";

import { Icon } from "@/components/icon";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/lib/i18n/language-provider";
import { AGENT_CATALOG } from "@/lib/permissions";
import type { AgentEnabledMap, AgentId } from "@/lib/types";

export function ControlPanel({
  enabled,
  onEnabled,
  minConfidence,
  hitlThreshold,
  onMinConfidence,
  onHitlThreshold,
}: {
  enabled: AgentEnabledMap;
  onEnabled: (next: AgentEnabledMap) => void;
  minConfidence: number;
  hitlThreshold: number;
  onMinConfidence: (n: number) => void;
  onHitlThreshold: (n: number) => void;
}) {
  const { t } = useLanguage();

  const toggle = (id: AgentId, value: boolean) => {
    onEnabled({ ...enabled, [id]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-on-surface text-sm font-medium">
          {t("controlPanel.agentsTitle")}
        </p>
        <p className="text-on-surface-variant mb-3 text-xs">
          {t("controlPanel.agentsDesc")}
        </p>
        <ul className="space-y-3">
          {AGENT_CATALOG.map((agent) => (
            <li
              key={agent.id}
              className="border-outline-variant/30 bg-surface-container flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <Icon
                  name={agent.icon}
                  className="text-primary text-[18px]"
                />
                <div>
                  <p className="text-on-surface text-sm font-medium">
                    {t(`agent.${agent.id}.name` as const)}
                  </p>
                  <p className="text-on-surface-variant text-xs">
                    {t(`agent.${agent.id}.role` as const)}
                  </p>
                </div>
              </div>
              <Switch
                checked={enabled[agent.id]}
                onCheckedChange={(v) => toggle(agent.id, v)}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="border-outline-variant/30 bg-surface-container-low space-y-4 rounded-lg border p-4">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label htmlFor="min-conf">{t("controlPanel.minConfidence")}</Label>
            <span className="text-primary font-code-md text-xs">
              {minConfidence.toFixed(2)}
            </span>
          </div>
          <input
            id="min-conf"
            type="range"
            min={0.4}
            max={0.95}
            step={0.01}
            value={minConfidence}
            onChange={(e) => onMinConfidence(Number(e.target.value))}
            className="accent-primary w-full"
          />
          <p className="text-on-surface-variant text-[11px]">
            {t("controlPanel.minConfidenceHint")}
          </p>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label htmlFor="hitl">{t("controlPanel.hitl")}</Label>
            <span className="font-code-md text-[#fcd34d] text-xs">
              {hitlThreshold.toFixed(2)}
            </span>
          </div>
          <input
            id="hitl"
            type="range"
            min={0.5}
            max={0.99}
            step={0.01}
            value={hitlThreshold}
            onChange={(e) => onHitlThreshold(Number(e.target.value))}
            className="w-full accent-[#d97706]"
          />
          <p className="text-on-surface-variant text-[11px]">
            {t("controlPanel.hitlHint")}
          </p>
        </div>
      </div>
    </div>
  );
}

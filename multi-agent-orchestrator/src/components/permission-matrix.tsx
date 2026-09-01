"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AGENT_CATALOG,
  PERMISSION_LABELS,
} from "@/lib/permissions";
import type { AgentId, PermissionKey, PermissionMap } from "@/lib/types";

const KEYS = Object.keys(PERMISSION_LABELS) as PermissionKey[];

export function PermissionMatrix({
  value,
  onChange,
}: {
  value: PermissionMap;
  onChange: (next: PermissionMap) => void;
}) {
  const toggle = (agent: AgentId, key: PermissionKey, checked: boolean) => {
    const current = new Set(value[agent] ?? []);
    if (checked) current.add(key);
    else current.delete(key);
    onChange({ ...value, [agent]: [...current] });
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-3 py-2 font-medium">Agente</th>
            {KEYS.map((key) => (
              <th key={key} className="px-2 py-2 text-xs font-medium">
                {PERMISSION_LABELS[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {AGENT_CATALOG.map((agent) => (
            <tr key={agent.id} className="border-t">
              <td className="px-3 py-2 font-medium">{agent.name}</td>
              {KEYS.map((key) => {
                const checked = value[agent.id]?.includes(key) ?? false;
                const id = `${agent.id}-${key}`;
                return (
                  <td key={key} className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={(state) =>
                          toggle(agent.id, key, state === true)
                        }
                      />
                      <Label htmlFor={id} className="sr-only">
                        {agent.name} {PERMISSION_LABELS[key]}
                      </Label>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

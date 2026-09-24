"use client";

import { EngineShell } from "@/components/engine-shell";
import { SettingsKeysDesk } from "@/components/settings-keys-desk";

export default function SettingsPage() {
  return (
    <EngineShell active="settings">
      <SettingsKeysDesk />
    </EngineShell>
  );
}

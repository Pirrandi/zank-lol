// DB-backed key/value settings, editable live from /admin/settings without a restart.
// Read from both the Next.js server (this file) and scripts/poll.ts (a separate long-running
// cron process) — both already share the same prisma singleton from src/lib/prisma.ts, so a
// value saved from the admin panel is picked up by poll.ts on its next iteration.

import { prisma } from "./prisma";

export const SETTING_KEYS = {
  discordAlertsEnabled: "discordAlertsEnabled",
  matchRecapChannelId: "matchRecapChannelId",
  predictionsChannelId: "predictionsChannelId",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export async function getSetting(key: SettingKey): Promise<string | undefined> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value;
}

export async function getAllSettings(): Promise<Record<SettingKey, string | undefined>> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    discordAlertsEnabled: byKey.get(SETTING_KEYS.discordAlertsEnabled),
    matchRecapChannelId: byKey.get(SETTING_KEYS.matchRecapChannelId),
    predictionsChannelId: byKey.get(SETTING_KEYS.predictionsChannelId),
  };
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

// Removing the row (instead of storing an empty string) lets the env var fallback kick back in.
export async function deleteSetting(key: SettingKey): Promise<void> {
  await prisma.setting.deleteMany({ where: { key } });
}

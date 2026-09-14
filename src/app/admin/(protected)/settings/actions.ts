"use server";

import { revalidatePath } from "next/cache";
import { deleteSetting, setSetting, SETTING_KEYS } from "@/lib/settings";

export async function saveSettingsAction(formData: FormData): Promise<void> {
  const discordAlertsEnabled = formData.get("discordAlertsEnabled") === "on";
  const matchRecapChannelId = String(formData.get("matchRecapChannelId") ?? "").trim();
  const predictionsChannelId = String(formData.get("predictionsChannelId") ?? "").trim();

  await setSetting(SETTING_KEYS.discordAlertsEnabled, discordAlertsEnabled ? "true" : "false");

  // Empty field = "no override", so delete the row instead of storing "" and let the env var
  // fallback take over again.
  if (matchRecapChannelId) {
    await setSetting(SETTING_KEYS.matchRecapChannelId, matchRecapChannelId);
  } else {
    await deleteSetting(SETTING_KEYS.matchRecapChannelId);
  }

  if (predictionsChannelId) {
    await setSetting(SETTING_KEYS.predictionsChannelId, predictionsChannelId);
  } else {
    await deleteSetting(SETTING_KEYS.predictionsChannelId);
  }

  revalidatePath("/admin/settings");
}

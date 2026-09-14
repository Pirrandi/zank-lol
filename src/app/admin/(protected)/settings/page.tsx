import { getAllSettings } from "@/lib/settings";
import { saveSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getAllSettings();
  const alertsEnabled =
    settings.discordAlertsEnabled !== undefined
      ? settings.discordAlertsEnabled === "true"
      : process.env.DISCORD_ALERTS_ENABLED === "true";

  const matchRecapFallback = process.env.DISCORD_MATCH_RECAP_CHANNEL_ID ?? process.env.DISCORD_CHANNEL_ID ?? "";
  const predictionsFallback = process.env.DISCORD_PREDICTIONS_CHANNEL_ID ?? process.env.DISCORD_CHANNEL_ID ?? "";

  return (
    <div style={{ maxWidth: 560, margin: "60px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 24px" }}>Configuración</h1>

      <form
        action={saveSettingsAction}
        className="card"
        style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600 }}>
          <input type="checkbox" name="discordAlertsEnabled" defaultChecked={alertsEnabled} />
          Avisos de Discord habilitados
        </label>
        <p style={{ margin: "-12px 0 0", fontSize: 12, color: "var(--color-neutral-500)" }}>
          Kill switch general: subidas/bajadas de rango, recaps de partida y predicciones.
        </p>

        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--color-neutral-600)" }}>
          Canal de recaps de partida (ID)
          <input
            type="text"
            name="matchRecapChannelId"
            defaultValue={settings.matchRecapChannelId ?? ""}
            placeholder={matchRecapFallback || "DISCORD_CHANNEL_ID"}
            className="input mono"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--color-neutral-600)" }}>
          Canal de predicciones (ID)
          <input
            type="text"
            name="predictionsChannelId"
            defaultValue={settings.predictionsChannelId ?? ""}
            placeholder={predictionsFallback || "DISCORD_CHANNEL_ID"}
            className="input mono"
          />
        </label>
        <p style={{ margin: "-12px 0 0", fontSize: 12, color: "var(--color-neutral-500)" }}>
          Vacío = usa la variable de entorno correspondiente (placeholder de arriba).
        </p>

        <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
          Guardar
        </button>
      </form>
    </div>
  );
}

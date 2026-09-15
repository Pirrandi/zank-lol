import { getAllSettings } from "@/lib/settings";
import { listPostableChannels, type DiscordChannelOption } from "@/lib/discord";
import { saveSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

const labelStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
  fontSize: 13,
  color: "var(--color-neutral-600)",
};

// Channels arrive pre-sorted in Discord sidebar order, so grouping consecutive runs by label
// keeps the <optgroup> blocks in that same order.
function groupByLabel(channels: DiscordChannelOption[]): { label: string; items: DiscordChannelOption[] }[] {
  const groups: { label: string; items: DiscordChannelOption[] }[] = [];
  for (const channel of channels) {
    const last = groups[groups.length - 1];
    if (last && last.label === channel.groupLabel) last.items.push(channel);
    else groups.push({ label: channel.groupLabel, items: [channel] });
  }
  return groups;
}

type ChannelFieldProps = {
  label: string;
  name: string;
  savedValue: string;
  fallback: string;
  /** null when the channel list could not be fetched — the field degrades to a raw ID input. */
  channels: DiscordChannelOption[] | null;
};

function ChannelField({ label, name, savedValue, fallback, channels }: ChannelFieldProps) {
  if (channels === null) {
    return (
      <label style={labelStyle}>
        {label} (ID)
        <input
          type="text"
          name={name}
          defaultValue={savedValue}
          placeholder={fallback || "DISCORD_CHANNEL_ID"}
          className="input mono"
        />
      </label>
    );
  }

  // A saved ID that no longer shows up in the list (channel deleted, bot lost access, or the
  // value points at another server) must stay selectable, otherwise saving would silently wipe it.
  const isOrphan = savedValue !== "" && !channels.some((c) => c.id === savedValue);

  return (
    <label style={labelStyle}>
      {label}
      <select name={name} defaultValue={savedValue} className="select mono">
        <option value="">Usar variable de entorno ({fallback || "sin definir"})</option>
        {isOrphan && <option value={savedValue}>ID guardado: {savedValue} (no encontrado)</option>}
        {groupByLabel(channels).map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.items.map((channel) => (
              <option key={channel.id} value={channel.id}>
                #{channel.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export default async function AdminSettingsPage() {
  const [settings, channelList] = await Promise.all([getAllSettings(), listPostableChannels()]);

  const alertsEnabled =
    settings.discordAlertsEnabled !== undefined
      ? settings.discordAlertsEnabled === "true"
      : process.env.DISCORD_ALERTS_ENABLED === "true";

  const matchRecapFallback = process.env.DISCORD_MATCH_RECAP_CHANNEL_ID ?? process.env.DISCORD_CHANNEL_ID ?? "";
  const predictionsFallback = process.env.DISCORD_PREDICTIONS_CHANNEL_ID ?? process.env.DISCORD_CHANNEL_ID ?? "";
  const rankUpFallback = process.env.DISCORD_RANKUP_CHANNEL_ID ?? process.env.DISCORD_CHANNEL_ID ?? "";

  const channels = channelList.ok ? channelList.channels : null;

  return (
    <div style={{ maxWidth: 640, margin: "60px auto", padding: "0 16px" }}>
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

        {channelList.ok ? (
          <>
            <p style={{ margin: 0, fontSize: 12, color: "var(--color-neutral-500)" }}>
              Servidor detectado: {channelList.guildNames.join(", ")}
            </p>
            {channelList.partialError && (
              <p style={{ margin: "-12px 0 0", color: "var(--color-loss)", fontSize: 13 }}>
                Lista de canales incompleta. {channelList.partialError} Recargá la página para
                reintentar.
              </p>
            )}
          </>
        ) : (
          <p style={{ margin: 0, color: "var(--color-loss)", fontSize: 13 }}>
            No se pudo cargar la lista de canales de Discord ({channelList.error}). Podés seguir
            configurando los canales pegando el ID a mano.
          </p>
        )}

        <ChannelField
          label="Canal de recaps de partida"
          name="matchRecapChannelId"
          savedValue={settings.matchRecapChannelId ?? ""}
          fallback={matchRecapFallback}
          channels={channels}
        />

        <ChannelField
          label="Canal de predicciones"
          name="predictionsChannelId"
          savedValue={settings.predictionsChannelId ?? ""}
          fallback={predictionsFallback}
          channels={channels}
        />

        <ChannelField
          label="Canal de avisos de rango"
          name="rankUpChannelId"
          savedValue={settings.rankUpChannelId ?? ""}
          fallback={rankUpFallback}
          channels={channels}
        />

        <p style={{ margin: "-12px 0 0", fontSize: 12, color: "var(--color-neutral-500)" }}>
          Vacío = usa la variable de entorno correspondiente.
        </p>

        <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
          Guardar
        </button>
      </form>
    </div>
  );
}

import { WIN_COLOR, LOSS_COLOR } from "./tier-colors";
import { getSetting, SETTING_KEYS } from "./settings";

const DISCORD_API_BASE = "https://discord.com/api/v10";

// Callers guard on DISCORD_BOT_TOKEN before hitting the API, so this only builds the header.
function botHeaders(): Record<string, string> {
  return { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN ?? ""}` };
}

// Global kill switch for all outbound Discord messages. Off by default. Editable live from the
// admin panel (/admin/settings) — the DB value wins when present, falling back to the
// DISCORD_ALERTS_ENABLED env var so nothing breaks before the panel has been used once.
async function discordMessagingEnabled(): Promise<boolean> {
  const dbValue = await getSetting(SETTING_KEYS.discordAlertsEnabled);
  if (dbValue !== undefined) return dbValue === "true";
  return process.env.DISCORD_ALERTS_ENABLED === "true";
}

async function postToDiscord(body: unknown, channelId?: string): Promise<{ id: string } | undefined> {
  if (!(await discordMessagingEnabled())) return undefined;

  const token = process.env.DISCORD_BOT_TOKEN;
  const targetChannel = channelId ?? process.env.DISCORD_CHANNEL_ID;
  if (!token || !targetChannel) return undefined;

  const res = await fetch(`${DISCORD_API_BASE}/channels/${targetChannel}/messages`, {
    method: "POST",
    headers: {
      ...botHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Discord API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function predictionsChannelId(): Promise<string | undefined> {
  const dbValue = await getSetting(SETTING_KEYS.predictionsChannelId);
  return dbValue || process.env.DISCORD_PREDICTIONS_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID;
}

async function matchRecapChannelId(): Promise<string | undefined> {
  const dbValue = await getSetting(SETTING_KEYS.matchRecapChannelId);
  return dbValue || process.env.DISCORD_MATCH_RECAP_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID;
}

async function rankUpChannelId(): Promise<string | undefined> {
  const dbValue = await getSetting(SETTING_KEYS.rankUpChannelId);
  return dbValue || process.env.DISCORD_RANKUP_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID;
}

export async function sendRankUpAlert(content: string): Promise<void> {
  await postToDiscord({ content }, await rankUpChannelId());
}

export async function sendRankUpImageAlert(
  imageUrl: string,
  accentColorHex: string,
  content?: string
): Promise<void> {
  await postToDiscord({
    content,
    embeds: [
      {
        color: parseInt(accentColorHex.replace("#", ""), 16),
        image: { url: imageUrl },
      },
    ],
  }, await rankUpChannelId());
}

export type MatchRecapEmbedParams = {
  gameName: string;
  tagLine: string;
  profileIconUrl: string;
  win: boolean;
  queueLabel: string;
  gameDurationLabel: string;
  championEmoji?: string;
  championName: string;
  enemyChampionEmoji?: string;
  enemyChampionName?: string;
  kills: number;
  deaths: number;
  assists: number;
  killParticipationPct?: number;
  cs: number;
  csPerMin: number;
  damage: number;
  rankLabel?: string;
  lp?: number;
  lpDelta?: number;
  itemEmojis: string[];
  footerText?: string;
};

function formatDamage(damage: number): string {
  if (damage >= 1000) return `${(damage / 1000).toFixed(1)}k`;
  return String(damage);
}

export async function sendMatchRecapEmbed(params: MatchRecapEmbedParams): Promise<void> {
  const kda = params.deaths === 0 ? "Perfect" : ((params.kills + params.assists) / params.deaths).toFixed(2);
  const resultLabel = params.win ? "VICTORIA" : "DERROTA";
  const color = parseInt((params.win ? WIN_COLOR : LOSS_COLOR).replace("#", ""), 16);

  const vsLine = params.enemyChampionName
    ? `**${resultLabel}** con ${params.championEmoji ?? ""} **${params.championName}** vs ${params.enemyChampionEmoji ?? ""} ${params.enemyChampionName}`
    : `**${resultLabel}** con ${params.championEmoji ?? ""} **${params.championName}**`;

  const fields: { name: string; value: string; inline: boolean }[] = [
    {
      name: "KDA",
      value: `${params.kills}/${params.deaths}/${params.assists} (${kda})`,
      inline: true,
    },
    {
      name: "CS",
      value: `${params.cs} (${params.csPerMin.toFixed(1)}/min)${
        params.killParticipationPct !== undefined ? ` • KP ${Math.round(params.killParticipationPct)}%` : ""
      }`,
      inline: true,
    },
    {
      name: "Daño",
      value: formatDamage(params.damage),
      inline: true,
    },
  ];

  if (params.rankLabel) {
    const deltaText =
      params.lpDelta !== undefined ? ` (${params.lpDelta >= 0 ? "+" : ""}${params.lpDelta})` : "";
    fields.push({
      name: "Rango",
      value: `**${params.rankLabel}** • ${params.lp ?? 0} LP${deltaText}`,
      inline: false,
    });
  }

  if (params.itemEmojis.length > 0) {
    fields.push({
      name: "Items",
      value: params.itemEmojis.join(" "),
      inline: false,
    });
  }

  await postToDiscord({
    embeds: [
      {
        color,
        author: {
          name: `${params.gameName}#${params.tagLine}`,
          icon_url: params.profileIconUrl,
        },
        description: `${params.queueLabel} • ${params.gameDurationLabel}\n${vsLine}`,
        fields,
        footer: params.footerText ? { text: params.footerText } : undefined,
      },
    ],
  }, await matchRecapChannelId());
}

export type GroupRecapPlayer = {
  gameName: string;
  tagLine: string;
  win: boolean;
  profileIconEmoji?: string;
  championEmoji?: string;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  rankLabel?: string;
  lpDelta?: number;
};

export type MatchGroupRecapEmbedParams = {
  queueLabel: string;
  gameDurationLabel: string;
  resultLabel: string;
  players: GroupRecapPlayer[];
  colorHex: string;
  footerText?: string;
};

export async function sendGroupMatchRecapEmbed(params: MatchGroupRecapEmbedParams): Promise<void> {
  const color = parseInt(params.colorHex.replace("#", ""), 16);

  const fields = params.players.map((p) => {
    const champLabel = `${p.championEmoji ? `${p.championEmoji} ` : ""}${p.championName}`;
    const kda = `${p.kills}/${p.deaths}/${p.assists}`;
    const rankLine =
      p.rankLabel !== undefined
        ? `\n${p.rankLabel}${p.lpDelta !== undefined ? ` (${p.lpDelta >= 0 ? "+" : ""}${p.lpDelta} LP)` : ""}`
        : "";
    const nameLabel = `${p.profileIconEmoji ? `${p.profileIconEmoji} ` : ""}${p.gameName}`;
    return {
      name: nameLabel,
      value: `${champLabel}\n${kda} · ${formatDamage(p.damage)} dmg${rankLine}`,
      inline: true,
    };
  });

  await postToDiscord({
    embeds: [
      {
        color,
        description: `🎮 **Partida compartida** — **${params.resultLabel}** • Ranked ${params.queueLabel} • ${params.gameDurationLabel}`,
        fields,
        footer: params.footerText ? { text: params.footerText } : undefined,
      },
    ],
  }, await matchRecapChannelId());
}

export async function sendPredictionRound(
  imageUrl: string,
  accentColorHex: string,
  content: string,
  winCustomId: string,
  loseCustomId: string
): Promise<string | undefined> {
  const message = await postToDiscord(
    {
      content,
      embeds: [
        {
          color: parseInt(accentColorHex.replace("#", ""), 16),
          image: { url: imageUrl },
        },
      ],
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: "✅ Gana", custom_id: winCustomId },
            { type: 2, style: 4, label: "❌ Pierde", custom_id: loseCustomId },
          ],
        },
      ],
    },
    await predictionsChannelId()
  );
  return message?.id;
}

export async function sendToPredictionsChannel(content: string): Promise<void> {
  await postToDiscord({ content }, await predictionsChannelId());
}

async function patchPredictionMessage(messageId: string, body: unknown): Promise<void> {
  if (!(await discordMessagingEnabled())) return;

  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = await predictionsChannelId();
  if (!token || !channelId) return;

  await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      ...botHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function closePredictionMessage(messageId: string, content: string): Promise<void> {
  await patchPredictionMessage(messageId, { content, components: [] });
}

export async function updatePredictionMessageContent(messageId: string, content: string): Promise<void> {
  await patchPredictionMessage(messageId, { content });
}

// ---------------------------------------------------------------------------
// Channel discovery — powers the channel dropdowns in /admin/settings.
// ---------------------------------------------------------------------------

export type DiscordChannelOption = { id: string; name: string; groupLabel: string };
export type DiscordChannelListResult =
  // `partialError` marks a read that succeeded for some guilds and failed for others: the dropdowns
  // are usable but incomplete, and the operator has to be told rather than shown a confident list.
  | { ok: true; guildNames: string[]; channels: DiscordChannelOption[]; partialError?: string }
  | { ok: false; error: string };

const CHANNEL_TYPE_TEXT = 0;
const CHANNEL_TYPE_CATEGORY = 4;
const CHANNEL_TYPE_ANNOUNCEMENT = 5;
const UNCATEGORIZED_LABEL = "Sin categoría";

const CHANNEL_CACHE_TTL_MS = 60_000;
// Single-entry in-memory cache: the settings page is force-dynamic, so without this every render
// (and every failed form submit re-render) would hit the Discord API again. Only complete successes
// are cached — see the partial-read guard before the write.
let channelCache: { at: number; result: Extract<DiscordChannelListResult, { ok: true }> } | undefined;

type RawGuild = { id: string; name?: string };
type RawChannel = { id: string; name?: string; type: number; parent_id?: string | null; position?: number };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Discord rate limits are per-route and usually sub-second. Retry once, capped so a page render
// can never hang on a long global bucket.
const MAX_RETRY_WAIT_MS = 5_000;

// Hard ceiling on any single Discord request. Without it a stalled connection (network partition,
// firewall black-hole) would hang the force-dynamic settings page render forever and the graceful
// degradation below would never get a chance to run — a catch only catches errors, not silence.
const REQUEST_TIMEOUT_MS = 8_000;

async function discordGet(path: string): Promise<Response> {
  const url = `${DISCORD_API_BASE}${path}`;
  // A timeout signal is single-use, so each attempt gets a fresh one.
  const attempt = (): Promise<Response> =>
    fetch(url, { headers: botHeaders(), cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

  const res = await attempt();
  if (res.status !== 429) return res;

  const retryAfterSeconds = await res
    .clone()
    .json()
    .then((data: { retry_after?: number }) => Number(data?.retry_after))
    .catch(() => NaN);
  const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 1000;
  await sleep(Math.min(waitMs, MAX_RETRY_WAIT_MS));

  return attempt();
}

async function failureFor(res: Response): Promise<Extract<DiscordChannelListResult, { ok: false }>> {
  const body = await res.text().catch(() => "");
  const shortText = body.replace(/\s+/g, " ").trim().slice(0, 120) || res.statusText;
  return { ok: false, error: `Discord respondió ${res.status}: ${shortText}` };
}

function unreachable(error: unknown): Extract<DiscordChannelListResult, { ok: false }> {
  const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
  if (timedOut) return { ok: false, error: "Discord no respondió a tiempo." };
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: `No se pudo contactar a Discord: ${message}` };
}

function channelsFromGuild(raw: RawChannel[], guildName: string, multiGuild: boolean): DiscordChannelOption[] {
  const categories = new Map<string, { name: string; position: number }>();
  for (const channel of raw) {
    if (channel.type === CHANNEL_TYPE_CATEGORY) {
      categories.set(channel.id, { name: channel.name ?? UNCATEGORIZED_LABEL, position: channel.position ?? 0 });
    }
  }

  return raw
    .filter((c) => c.type === CHANNEL_TYPE_TEXT || c.type === CHANNEL_TYPE_ANNOUNCEMENT)
    .map((c) => {
      const category = c.parent_id ? categories.get(c.parent_id) : undefined;
      return {
        id: c.id,
        name: c.name ?? c.id,
        categoryName: category?.name ?? UNCATEGORIZED_LABEL,
        // Discord renders parentless channels above every category, hence the -1.
        categoryPosition: category?.position ?? -1,
        position: c.position ?? 0,
      };
    })
    // Mirror the Discord sidebar order: category first, then channel position inside it.
    .sort((a, b) =>
      a.categoryPosition !== b.categoryPosition
        ? a.categoryPosition - b.categoryPosition
        : a.position - b.position
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      groupLabel: multiGuild ? `${guildName} · ${c.categoryName}` : c.categoryName,
    }));
}

// Always resolves — the admin panel degrades to plain text inputs on failure instead of breaking.
export async function listPostableChannels(): Promise<DiscordChannelListResult> {
  if (!process.env.DISCORD_BOT_TOKEN) {
    return { ok: false, error: "DISCORD_BOT_TOKEN no está configurado." };
  }

  const cached = channelCache;
  if (cached && Date.now() - cached.at < CHANNEL_CACHE_TTL_MS) return cached.result;

  try {
    const configuredGuildId = process.env.DISCORD_GUILD_ID;
    let guilds: RawGuild[];

    if (configuredGuildId) {
      const res = await discordGet(`/guilds/${configuredGuildId}`);
      if (!res.ok) return await failureFor(res);
      const guild: RawGuild = await res.json();
      guilds = [{ id: configuredGuildId, name: guild.name ?? configuredGuildId }];
    } else {
      const res = await discordGet("/users/@me/guilds");
      if (!res.ok) return await failureFor(res);
      guilds = await res.json();
    }

    if (guilds.length === 0) {
      return { ok: false, error: "El bot no está en ningún servidor de Discord." };
    }

    const multiGuild = guilds.length > 1;

    // Fan out per guild: sequential awaits would multiply both latency and the 429 retry wait by the
    // guild count, and one forbidden or unreachable guild must not discard the channels of the rest.
    const perGuild = await Promise.all(
      guilds.map(async (guild) => {
        const guildName = guild.name ?? guild.id;
        try {
          const res = await discordGet(`/guilds/${guild.id}/channels`);
          if (!res.ok) return { guildName, failure: await failureFor(res) };
          const raw: RawChannel[] = await res.json();
          return { guildName, channels: channelsFromGuild(raw, guildName, multiGuild) };
        } catch (error) {
          return { guildName, failure: unreachable(error) };
        }
      })
    );

    const guildNames: string[] = [];
    const failedGuildNames: string[] = [];
    const channels: DiscordChannelOption[] = [];
    let lastFailure: Extract<DiscordChannelListResult, { ok: false }> | undefined;

    for (const entry of perGuild) {
      // An empty channel list is a success, not a failure: [] is truthy, so it falls through here.
      if (!("channels" in entry) || !entry.channels) {
        failedGuildNames.push(entry.guildName);
        lastFailure = "failure" in entry ? entry.failure : undefined;
        continue;
      }
      guildNames.push(entry.guildName);
      channels.push(...entry.channels);
    }

    // Only a total wipeout degrades the panel; a partial read still beats raw-ID inputs.
    if (guildNames.length === 0) {
      return lastFailure ?? { ok: false, error: "No se pudieron leer los canales de Discord." };
    }

    // Isolating guilds must not turn a loud failure into a silent one: say which guilds are missing.
    const partialError =
      failedGuildNames.length > 0
        ? `Faltan los canales de: ${failedGuildNames.join(", ")}.${lastFailure ? ` ${lastFailure.error}` : ""}`
        : undefined;

    const result = { ok: true as const, guildNames, channels, partialError };
    // A partial read is never cached, so a transient guild failure is retried on the next render
    // instead of being pinned for the whole TTL.
    if (!partialError) channelCache = { at: Date.now(), result };
    return result;
  } catch (error) {
    return unreachable(error);
  }
}

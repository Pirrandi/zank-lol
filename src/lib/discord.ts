import { WIN_COLOR, LOSS_COLOR } from "./tier-colors";
import { getSetting, SETTING_KEYS } from "./settings";

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

  const res = await fetch(`https://discord.com/api/v10/channels/${targetChannel}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
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

export async function sendRankUpAlert(content: string): Promise<void> {
  await postToDiscord({ content });
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
  });
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

  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${token}`,
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

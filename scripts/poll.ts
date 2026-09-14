import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { getRankedEntries, getMatchIds, getMatchDetail, getSummonerByPuuid, getActiveGame, type MatchParticipant } from "../src/lib/riot";
import { divisionIndex, getLpScore } from "../src/lib/rank-order";
import { tierLabel, TIER_COLORS, UNRANKED_COLOR, WIN_COLOR, LOSS_COLOR, FLAT_COLOR } from "../src/lib/tier-colors";
import { sendRankUpAlert, sendRankUpImageAlert, sendPredictionRound, sendToPredictionsChannel, closePredictionMessage, sendMatchRecapEmbed, sendGroupMatchRecapEmbed } from "../src/lib/discord";
import { lossStreak } from "../src/lib/derive";
import { getChampionSplashUrl, getChampionDisplayName, getProfileIconUrl } from "../src/lib/ddragon";
import { getChampionEmoji, getItemEmoji, getOrUploadPlayerEmoji } from "../src/lib/discord-emojis";
import { generateRoast } from "../src/lib/groq";
import { resolvePredictions } from "../src/lib/betting";

const prisma = new PrismaClient();
const POLL_DELAY_MS = 120;
const SOLO_QUEUE_ID = 420;
const SITE_URL = "https://zank.lol";

const QUEUE_LABELS: Record<string, string> = {
  RANKED_SOLO_5x5: "Solo/Dúo",
  RANKED_FLEX_SR: "Flexible",
};

const RANKED_QUEUE_IDS: Record<string, number> = {
  RANKED_SOLO_5x5: 420,
  RANKED_FLEX_SR: 440,
};

const QUEUE_TYPE_BY_CONFIG_ID: Record<number, string> = {
  420: "RANKED_SOLO_5x5",
  440: "RANKED_FLEX_SR",
};

const ROAST_STYLE_GUIDE =
  "Sos un cabro chileno escribiendo un comentario corto en el Discord de tu grupo de amigos. Hablá natural, como se escribe realmente entre amigos por chat — nada de forzar modismos ni acumular varios juntos en la misma frase (no uses 'po', 'weón' y 'cachai' todos apretados). Como mucho un chilenismo si de verdad suma, y puede que ni haga falta ninguno. Directo, con humor seco, sin sonar a caricatura ni a alguien tratando de sonar chileno.";

function buildRoastPrompt(situation: string): string {
  return `${ROAST_STYLE_GUIDE} ${situation} Máximo 18 palabras, sin comillas, sin emojis, solo la frase.`;
}

const LOSS_STREAK_MESSAGES: Record<number, (tag: string) => string> = {
  3: (tag) => `😭 **${tag}** lleva **3** derrotas seguidas. Andar tocado.`,
  5: (tag) => `🔥💀 **${tag}** lleva **5** derrotas seguidas. Momento de tirar el mouse.`,
  7: (tag) => `🚨 **${tag}** lleva **7** derrotas seguidas. Alguien que le saque el internet.`,
  10: (tag) => `☠️ **${tag}** lleva **10** derrotas seguidas. Esto ya no es racha, es un estilo de vida.`,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type NewRankedMatch = {
  matchId: string;
  queueId: number;
  gameDuration: number;
  participant: MatchParticipant;
  enemyParticipant?: MatchParticipant;
};

type PendingRecap = {
  account: { gameName: string; tagLine: string; profileIconId: number | null };
  match: NewRankedMatch;
  queueLabel: string;
  rankLabel: string | undefined;
  lp: number | undefined;
  lpDelta: number | undefined;
};

async function pollMatches(
  accountId: string,
  puuid: string
): Promise<{ inserted: number; newRankedMatches: NewRankedMatch[] }> {
  const matchIds = await getMatchIds(puuid, "americas", 10);
  await sleep(POLL_DELAY_MS);

  const existing = await prisma.matchParticipation.findMany({
    where: { accountId, matchId: { in: matchIds } },
    select: { matchId: true },
  });
  const existingIds = new Set(existing.map((e) => e.matchId));
  const newMatchIds = matchIds.filter((id) => !existingIds.has(id));

  let inserted = 0;
  const newRankedMatches: NewRankedMatch[] = [];
  for (const matchId of newMatchIds) {
    const detail = await getMatchDetail(matchId, "americas");
    await sleep(POLL_DELAY_MS);

    const participant = detail.info.participants.find((p) => p.puuid === puuid);
    if (!participant) continue;

    await prisma.match.upsert({
      where: { id: matchId },
      update: {},
      create: {
        id: matchId,
        queueId: detail.info.queueId,
        gameCreation: new Date(detail.info.gameCreation),
        gameDuration: detail.info.gameDuration,
      },
    });

    await prisma.matchParticipation.create({
      data: {
        matchId,
        accountId,
        championName: participant.championName,
        championId: participant.championId,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        win: participant.win,
        teamId: participant.teamId,
        doubleKills: participant.doubleKills,
        tripleKills: participant.tripleKills,
        quadraKills: participant.quadraKills,
        pentaKills: participant.pentaKills,
        epicSteals: participant.challenges?.epicMonsterSteals ?? 0,
      },
    });
    inserted++;

    if (Object.values(RANKED_QUEUE_IDS).includes(detail.info.queueId)) {
      const enemyParticipant = detail.info.participants.find(
        (p) => p.teamId !== participant.teamId && p.teamPosition === participant.teamPosition
      );
      newRankedMatches.push({
        matchId,
        queueId: detail.info.queueId,
        gameDuration: detail.info.gameDuration,
        participant,
        enemyParticipant,
      });
    }
  }

  return { inserted, newRankedMatches };
}

function formatGameDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

async function sendRecapForMatch(
  account: { gameName: string; tagLine: string; profileIconId: number | null },
  match: NewRankedMatch,
  queueLabel: string,
  rankLabel: string | undefined,
  lp: number | undefined,
  lpDelta: number | undefined
): Promise<void> {
  const { participant, enemyParticipant } = match;

  const [championName, enemyChampionName, profileIconUrl] = await Promise.all([
    getChampionDisplayName(participant.championId),
    enemyParticipant ? getChampionDisplayName(enemyParticipant.championId) : Promise.resolve(undefined),
    account.profileIconId !== null ? getProfileIconUrl(account.profileIconId) : Promise.resolve(undefined),
  ]);

  const cs = participant.totalMinionsKilled + participant.neutralMinionsKilled;
  const csPerMin = match.gameDuration > 0 ? cs / (match.gameDuration / 60) : 0;
  const killParticipationPct = participant.challenges?.killParticipation
    ? participant.challenges.killParticipation * 100
    : undefined;

  const itemIds = [
    participant.item0,
    participant.item1,
    participant.item2,
    participant.item3,
    participant.item4,
    participant.item5,
  ].filter((id) => id > 0);
  const itemEmojis = itemIds.map((id) => getItemEmoji(id)).filter((e): e is string => Boolean(e));

  const highlightBits: string[] = [];
  if (participant.pentaKills > 0) highlightBits.push(`una PENTAKILL`);
  else if (participant.quadraKills > 0) highlightBits.push(`una quadrakill`);
  else if (participant.tripleKills > 0) highlightBits.push(`una triple kill`);
  if ((participant.challenges?.epicMonsterSteals ?? 0) > 0) highlightBits.push(`robó un objetivo épico`);
  if (killParticipationPct !== undefined && killParticipationPct >= 70) highlightBits.push(`${Math.round(killParticipationPct)}% de participación en kills`);

  const situation =
    highlightBits.length > 0
      ? `Escribí una línea corta y punchy destacando que ${account.gameName}#${account.tagLine} tuvo ${highlightBits.join(" y ")} jugando ${championName ?? participant.championName}, en una partida que ${participant.win ? "ganó" : "perdió"}.`
      : `Escribí una línea corta y punchy resumiendo la partida de ${account.gameName}#${account.tagLine} con ${championName ?? participant.championName} (${participant.kills}/${participant.deaths}/${participant.assists}), que ${participant.win ? "ganó" : "perdió"}.`;

  const footerText = await generateRoast(buildRoastPrompt(situation));

  try {
    await sendMatchRecapEmbed({
      gameName: account.gameName,
      tagLine: account.tagLine,
      profileIconUrl: profileIconUrl ?? "",
      win: participant.win,
      queueLabel,
      gameDurationLabel: formatGameDuration(match.gameDuration),
      championEmoji: getChampionEmoji(participant.championId),
      championName: championName ?? participant.championName,
      enemyChampionEmoji: enemyParticipant ? getChampionEmoji(enemyParticipant.championId) : undefined,
      enemyChampionName,
      kills: participant.kills,
      deaths: participant.deaths,
      assists: participant.assists,
      killParticipationPct,
      cs,
      csPerMin,
      damage: participant.totalDamageDealtToChampions,
      rankLabel,
      lp,
      lpDelta,
      itemEmojis,
      footerText,
    });
  } catch (err) {
    console.error(`Failed to send match recap for ${account.gameName}#${account.tagLine} (${match.matchId}):`, err);
  }
}

async function sendGroupRecapForMatch(recaps: PendingRecap[]): Promise<void> {
  const first = recaps[0];
  const gameDurationLabel = formatGameDuration(first.match.gameDuration);

  const players = await Promise.all(
    recaps.map(async (r) => {
      const p = r.match.participant;
      const [championName, profileIconEmoji] = await Promise.all([
        getChampionDisplayName(p.championId),
        getOrUploadPlayerEmoji(r.account.profileIconId),
      ]);
      return {
        gameName: r.account.gameName,
        tagLine: r.account.tagLine,
        win: p.win,
        profileIconEmoji,
        championEmoji: getChampionEmoji(p.championId),
        championName: championName ?? p.championName,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        damage: p.totalDamageDealtToChampions,
        rankLabel: r.rankLabel,
        lpDelta: r.lpDelta,
      };
    })
  );

  const allWon = recaps.every((r) => r.match.participant.win);
  const allLost = recaps.every((r) => !r.match.participant.win);
  const colorHex = allWon ? WIN_COLOR : allLost ? LOSS_COLOR : FLAT_COLOR;
  const resultLabel = allWon ? "VICTORIA" : allLost ? "DERROTA" : "RESULTADO MIXTO";

  const winners = recaps.filter((r) => r.match.participant.win).map((r) => r.account.gameName);
  const losers = recaps.filter((r) => !r.match.participant.win).map((r) => r.account.gameName);

  const kdaScore = (p: MatchParticipant) => (p.deaths === 0 ? p.kills + p.assists : (p.kills + p.assists) / p.deaths);
  const standout = recaps.reduce((best, r) =>
    kdaScore(r.match.participant) > kdaScore(best.match.participant) ? r : best
  , recaps[0]);
  const pentaPlayer = recaps.find((r) => r.match.participant.pentaKills > 0);

  const situationBits: string[] = [];
  if (allWon) situationBits.push(`el grupo ganó completo`);
  else if (allLost) situationBits.push(`el grupo perdió completo`);
  else situationBits.push(`resultado mixto: ganaron ${winners.join(", ")} y perdieron ${losers.join(", ")}`);
  if (pentaPlayer) situationBits.push(`${pentaPlayer.account.gameName} hizo una PENTAKILL`);

  const situation = `Escribí una línea corta y punchy sobre una partida en grupo de ${recaps.length} amigos jugando juntos: ${situationBits.join(", ")}. El que mejor la rompió fue ${standout.account.gameName} con ${standout.match.participant.kills}/${standout.match.participant.deaths}/${standout.match.participant.assists}.`;

  const roast = await generateRoast(buildRoastPrompt(situation));
  const fallbackFooter = allWon
    ? `¡${recaps.length} del grupo ganaron juntos! 🏆`
    : allLost
      ? `${recaps.length} del grupo cayeron juntos en esta 💀`
      : `Resultado mixto para el grupo en esta partida.`;

  try {
    await sendGroupMatchRecapEmbed({
      queueLabel: first.queueLabel,
      gameDurationLabel,
      resultLabel,
      players,
      colorHex,
      footerText: roast ?? fallbackFooter,
    });
  } catch (err) {
    console.error(`Failed to send group match recap for match ${first.match.matchId}:`, err);
  }
}

async function resolveOpenPredictionRounds(accountId: string, gameName: string, tagLine: string): Promise<void> {
  const account = await prisma.trackedAccount.findUnique({ where: { id: accountId } });
  if (!account) return;

  const openRounds = await prisma.predictionRound.findMany({
    where: { accountId, status: "open", gameId: { not: null } },
    include: { predictions: true },
  });

  for (const round of openRounds) {
    const expectedMatchId = `${account.platform.toUpperCase()}_${round.gameId}`;
    const finishedMatch = await prisma.matchParticipation.findFirst({
      where: { accountId, matchId: expectedMatchId },
    });
    if (!finishedMatch) continue;

    const result = finishedMatch.win;
    await prisma.predictionRound.update({
      where: { id: round.id },
      data: { status: "resolved", result, resolvedAt: new Date(), matchId: finishedMatch.matchId },
    });

    const { correct, wrong } = await resolvePredictions(round.predictions, result);
    const outcomeLabel = result ? "GANÓ 🎉" : "PERDIÓ 💀";
    const tag = `${gameName}#${tagLine}`;

    try {
      await closePredictionMessage(round.messageId, `Apuestas cerradas — ${tag} ${outcomeLabel}`);
    } catch (err) {
      console.error(`Failed to close prediction message for ${tag}:`, err);
    }

    const correctText =
      correct.length > 0
        ? correct.map((p) => `<@${p.discordUserId}> (+${p.payout})`).join(" ")
        : "nadie 😔";
    const wrongText =
      wrong.length > 0
        ? wrong.map((p) => `<@${p.discordUserId}>${p.amount > 0 ? ` (-${p.amount})` : ""}`).join(" ")
        : "nadie";

    try {
      await sendToPredictionsChannel(
        `📊 **${tag} ${outcomeLabel}** — Acertaron: ${correctText}${wrong.length > 0 ? `\nSe equivocaron: ${wrongText}` : ""}`
      );
    } catch (err) {
      console.error(`Failed to announce prediction result for ${tag}:`, err);
    }
  }
}

async function main() {
  const accounts = await prisma.trackedAccount.findMany();
  let keyExpiredLogged = false;
  const pendingRecapsByMatch = new Map<string, PendingRecap[]>();

  for (const account of accounts) {
    try {
      if (account.profileIconId === null) {
        try {
          const summoner = await getSummonerByPuuid(account.puuid, account.platform);
          await sleep(POLL_DELAY_MS);
          await prisma.trackedAccount.update({
            where: { id: account.id },
            data: { profileIconId: summoner.profileIconId },
          });
        } catch (err) {
          console.error(`Failed to fetch profile icon for ${account.gameName}#${account.tagLine}:`, err);
        }
      }

      try {
        const activeGame = await getActiveGame(account.puuid, account.platform);
        await sleep(POLL_DELAY_MS);
        const isInGame = activeGame !== null;

        if (isInGame && !account.inGame) {
          const queueType = activeGame && QUEUE_TYPE_BY_CONFIG_ID[activeGame.gameQueueConfigId];
          if (queueType) {
            try {
              const me = activeGame!.participants.find((p) => p.puuid === account.puuid);
              if (me) {
                const gameId = String(activeGame!.gameId);
                const existingOpen = await prisma.predictionRound.findFirst({
                  where: { gameId, status: "open" },
                });
                if (!existingOpen) {
                  const matchedAccounts = accounts.filter((a) =>
                    activeGame!.participants.some((p) => p.puuid === a.puuid)
                  );
                  const queueLabel = QUEUE_LABELS[queueType] ?? queueType;
                  const [championName, matchedSnapshots] = await Promise.all([
                    getChampionDisplayName(me.championId),
                    Promise.all(
                      matchedAccounts.map((a) =>
                        prisma.rankSnapshot.findFirst({
                          where: { accountId: a.id, queueType },
                          orderBy: { capturedAt: "desc" },
                        })
                      )
                    ),
                  ]);
                  const snapshot = matchedSnapshots[matchedAccounts.findIndex((a) => a.id === account.id)];
                  const accentColor = snapshot
                    ? (TIER_COLORS[snapshot.tier.toUpperCase()] ?? UNRANKED_COLOR).fg
                    : "#E9FF1F";
                  const rankLabel = snapshot ? tierLabel(snapshot.tier, snapshot.rank) : undefined;

                  const ownTeam = activeGame!.participants
                    .filter((p) => p.teamId === me.teamId)
                    .map((p) => p.championId);
                  const enemyTeam = activeGame!.participants
                    .filter((p) => p.teamId !== me.teamId)
                    .map((p) => p.championId);

                  const allPlayers: {
                    championId: number;
                    tracked: boolean;
                    name?: string;
                    tag?: string;
                    tier?: string;
                    rank?: string;
                    lp?: number;
                  }[] = [];

                  for (const p of activeGame!.participants) {
                    const trackedAccount = matchedAccounts.find((a) => a.puuid === p.puuid);
                    if (trackedAccount) {
                      const snap = matchedSnapshots[matchedAccounts.indexOf(trackedAccount)];
                      allPlayers.push({
                        championId: p.championId,
                        tracked: true,
                        name: trackedAccount.gameName,
                        tag: trackedAccount.tagLine,
                        tier: snap?.tier,
                        rank: snap?.rank,
                        lp: snap?.leaguePoints,
                      });
                      continue;
                    }
                    try {
                      const entries = await getRankedEntries(p.puuid, account.platform);
                      await sleep(POLL_DELAY_MS);
                      const entry = entries.find((e) => e.queueType === queueType);
                      allPlayers.push({
                        championId: p.championId,
                        tracked: false,
                        tier: entry?.tier,
                        rank: entry?.rank,
                        lp: entry?.leaguePoints,
                      });
                    } catch (err) {
                      console.error(`Failed to fetch rank for opponent (champion ${p.championId}):`, err);
                      allPlayers.push({ championId: p.championId, tracked: false });
                    }
                  }

                  const params = new URLSearchParams({
                    team1: ownTeam.join(","),
                    team2: enemyTeam.join(","),
                    players: JSON.stringify(allPlayers),
                    queue: queueLabel,
                    kicker: "¿Gana o pierde?",
                  });

                  const content =
                    matchedAccounts.length > 1
                      ? `🎮 **${matchedAccounts.length} del grupo entraron juntos** a una partida de **${queueLabel}**: ${matchedAccounts.map((a) => a.gameName).join(", ")}.\n¿Quién gana? Tenés **5 minutos** para apostar.`
                      : `🎮 **${account.gameName}#${account.tagLine}** entró a una partida de **${queueLabel}**` +
                        `${championName ? ` con **${championName}**` : ""}` +
                        `${rankLabel ? ` (${rankLabel})` : ""}.\n¿Gana o pierde? Tenés **5 minutos** para apostar.`;

                  const roundId = randomUUID();
                  const messageId = await sendPredictionRound(
                    `${SITE_URL}/api/prediction-image?${params.toString()}`,
                    accentColor,
                    content,
                    `predict:win:${roundId}`,
                    `predict:lose:${roundId}`
                  );

                  if (messageId) {
                    await prisma.predictionRound.create({
                      data: {
                        id: roundId,
                        accountId: account.id,
                        gameId,
                        queueType,
                        championId: me.championId,
                        messageId,
                        content,
                      },
                    });
                  }
                }
              }
            } catch (err) {
              console.error(`Failed to start prediction round for ${account.gameName}#${account.tagLine}:`, err);
            }
          }
        }

        if (isInGame !== account.inGame) {
          await prisma.trackedAccount.update({
            where: { id: account.id },
            data: { inGame: isInGame },
          });
        }
      } catch (err) {
        console.error(`Failed to check active game for ${account.gameName}#${account.tagLine}:`, err);
      }

      const { inserted: insertedMatches, newRankedMatches } = await pollMatches(account.id, account.puuid);
      console.log(
        `  Matches for ${account.gameName}#${account.tagLine}: ${insertedMatches} new`
      );

      if (insertedMatches > 0) {
        await resolveOpenPredictionRounds(account.id, account.gameName, account.tagLine);
      }

      const entries = await getRankedEntries(account.puuid, account.platform);
      await sleep(POLL_DELAY_MS);

      for (const entry of entries) {
        const previous = await prisma.rankSnapshot.findFirst({
          where: { accountId: account.id, queueType: entry.queueType },
          orderBy: { capturedAt: "desc" },
        });

        await prisma.rankSnapshot.create({
          data: {
            accountId: account.id,
            queueType: entry.queueType,
            tier: entry.tier,
            rank: entry.rank,
            leaguePoints: entry.leaguePoints,
            wins: entry.wins,
            losses: entry.losses,
            hotStreak: entry.hotStreak,
          },
        });

        const matchesForQueue = newRankedMatches.filter(
          (m) => m.queueId === RANKED_QUEUE_IDS[entry.queueType]
        );
        for (const match of matchesForQueue) {
          const list = pendingRecapsByMatch.get(match.matchId) ?? [];
          list.push({
            account,
            match,
            queueLabel: QUEUE_LABELS[entry.queueType] ?? entry.queueType,
            rankLabel: tierLabel(entry.tier, entry.rank),
            lp: entry.leaguePoints,
            lpDelta: previous ? getLpScore(entry) - getLpScore(previous) : undefined,
          });
          pendingRecapsByMatch.set(match.matchId, list);
        }

        if (previous && divisionIndex(entry) > divisionIndex(previous)) {
          const queueLabel = QUEUE_LABELS[entry.queueType] ?? entry.queueType;
          try {
            let lastMatchChampionId: number | undefined;
            try {
              const freshMatchIds = await getMatchIds(account.puuid, "americas", 1, RANKED_QUEUE_IDS[entry.queueType]);
              await sleep(POLL_DELAY_MS);
              if (freshMatchIds[0]) {
                const detail = await getMatchDetail(freshMatchIds[0], "americas");
                await sleep(POLL_DELAY_MS);
                lastMatchChampionId = detail.info.participants.find((p) => p.puuid === account.puuid)?.championId;
              }
            } catch {
              const lastMatch = await prisma.matchParticipation.findFirst({
                where: { accountId: account.id, match: { queueId: RANKED_QUEUE_IDS[entry.queueType] } },
                include: { match: true },
                orderBy: { match: { gameCreation: "desc" } },
              });
              lastMatchChampionId = lastMatch?.championId;
            }

            const splashUrl = lastMatchChampionId !== undefined ? await getChampionSplashUrl(lastMatchChampionId) : undefined;
            const championDisplayName =
              lastMatchChampionId !== undefined ? await getChampionDisplayName(lastMatchChampionId) : undefined;
            const accentColor = (TIER_COLORS[entry.tier.toUpperCase()] ?? UNRANKED_COLOR).fg;

            const params = new URLSearchParams({
              name: account.gameName,
              tag: account.tagLine,
              tier: entry.tier,
              rank: entry.rank,
              lp: String(entry.leaguePoints),
              queue: queueLabel,
            });
            if (splashUrl) params.set("splash", splashUrl);
            if (championDisplayName) params.set("champion", championDisplayName);

            const hype = await generateRoast(
              buildRoastPrompt(
                `Escribí una frase de hype celebrando que ${account.gameName}#${account.tagLine} subió a ${tierLabel(entry.tier, entry.rank)} en ${queueLabel}${championDisplayName ? ` jugando ${championDisplayName}` : ""}.`
              )
            );

            await sendRankUpImageAlert(
              `${SITE_URL}/api/rankup-image?${params.toString()}`,
              accentColor,
              hype ? `🎉 ${hype}` : undefined
            );
          } catch (err) {
            console.error(`Failed to send Discord rank-up alert for ${account.gameName}#${account.tagLine}:`, err);
          }
        }

        if (previous && divisionIndex(entry) < divisionIndex(previous)) {
          const queueLabel = QUEUE_LABELS[entry.queueType] ?? entry.queueType;
          const newLabel = tierLabel(entry.tier, entry.rank);
          try {
            const roast = await generateRoast(
              buildRoastPrompt(
                `Escribí un roast picante pero sin insultos graves ni groserías fuertes, buleando amistosamente a ${account.gameName}#${account.tagLine} porque bajó de rango a ${newLabel} en ${queueLabel}.`
              )
            );
            const fallback = `**${account.gameName}#${account.tagLine}** bajó a **${newLabel}** en ${queueLabel}. Qué vergüenza.`;
            await sendRankUpAlert(`💩 ${roast ?? fallback}`);
          } catch (err) {
            console.error(`Failed to send Discord derank alert for ${account.gameName}#${account.tagLine}:`, err);
          }
        }
      }

      console.log(
        `Polled ${account.gameName}#${account.tagLine}: ${entries.length} queue entr${entries.length === 1 ? "y" : "ies"}`
      );

      if (insertedMatches > 0) {
        const soloParticipations = await prisma.matchParticipation.findMany({
          where: { accountId: account.id, match: { queueId: SOLO_QUEUE_ID } },
          include: { match: true },
          orderBy: { match: { gameCreation: "desc" } },
        });
        const streak = lossStreak(soloParticipations);
        const messageFor = LOSS_STREAK_MESSAGES[streak];
        if (messageFor) {
          try {
            const roast = await generateRoast(
              buildRoastPrompt(
                `Escribí un roast picante pero sin insultos graves ni groserías fuertes, sobre ${account.gameName}#${account.tagLine} que lleva ${streak} derrotas seguidas en Solo/Dúo.`
              )
            );
            await sendRankUpAlert(roast ? `😭 ${roast}` : messageFor(`${account.gameName}#${account.tagLine}`));
          } catch (err) {
            console.error(`Failed to send Discord loss-streak alert for ${account.gameName}#${account.tagLine}:`, err);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to poll ${account.gameName}#${account.tagLine}:`, err);
      if (!keyExpiredLogged && err instanceof Error && err.message.includes("401")) {
        console.error("RIOT KEY EXPIRED - regenerate at https://developer.riotgames.com/");
        keyExpiredLogged = true;
      }
    }
  }

  for (const [matchId, recaps] of pendingRecapsByMatch) {
    try {
      if (recaps.length === 1) {
        const r = recaps[0];
        await sendRecapForMatch(r.account, r.match, r.queueLabel, r.rankLabel, r.lp, r.lpDelta);
      } else {
        await sendGroupRecapForMatch(recaps);
      }
    } catch (err) {
      console.error(`Failed to send recap(s) for match ${matchId}:`, err);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

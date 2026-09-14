import { PrismaClient } from "@prisma/client";
import { getRankedEntries, getMatchIds, getMatchDetail, getSummonerByPuuid, getActiveGame } from "../src/lib/riot";
import { divisionIndex } from "../src/lib/rank-order";
import { tierLabel, TIER_COLORS, UNRANKED_COLOR } from "../src/lib/tier-colors";
import { sendRankUpAlert, sendRankUpImageAlert } from "../src/lib/discord";
import { lossStreak } from "../src/lib/derive";
import { getChampionSplashUrl, getChampionDisplayName } from "../src/lib/ddragon";
import { generateRoast } from "../src/lib/groq";

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

async function pollMatches(accountId: string, puuid: string): Promise<number> {
  const matchIds = await getMatchIds(puuid, "americas", 10);
  await sleep(POLL_DELAY_MS);

  const existing = await prisma.matchParticipation.findMany({
    where: { accountId, matchId: { in: matchIds } },
    select: { matchId: true },
  });
  const existingIds = new Set(existing.map((e) => e.matchId));
  const newMatchIds = matchIds.filter((id) => !existingIds.has(id));

  let inserted = 0;
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
  }

  return inserted;
}

async function main() {
  const accounts = await prisma.trackedAccount.findMany();
  let keyExpiredLogged = false;

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
        if (isInGame !== account.inGame) {
          await prisma.trackedAccount.update({
            where: { id: account.id },
            data: { inGame: isInGame },
          });
        }
      } catch (err) {
        console.error(`Failed to check active game for ${account.gameName}#${account.tagLine}:`, err);
      }

      const insertedMatches = await pollMatches(account.id, account.puuid);
      console.log(
        `  Matches for ${account.gameName}#${account.tagLine}: ${insertedMatches} new`
      );

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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";
import { buildQueueStats, winrate } from "../src/lib/queue-stats";
import { winStreak, lossStreak, totalLpGained, peakRank } from "../src/lib/derive";
import { tierLabel } from "../src/lib/tier-colors";
import { getHeadToHeadRecords } from "../src/lib/head-to-head";
import { generateRoast } from "../src/lib/groq";

const prisma = new PrismaClient();

const ANALYSIS_STYLE_GUIDE =
  "Sos un cabro chileno haciendo un informe corto de scouting sobre un amigo, para el Discord del grupo. Hablá natural, sin forzar modismos ni acumular varios juntos en la misma frase. Mezclá observaciones reales de sus stats con humor seco. Si viene jugando bien, reconocelo de verdad (no seas condescendiente); si viene mal, hacele el roast que se merece. No inventes datos que no te dé — usá solo lo que te paso.";

async function buildAnalysis(accountId: string, gameName: string, tagLine: string): Promise<string | undefined> {
  const soloSnapshotsDesc = await prisma.rankSnapshot.findMany({
    where: { accountId, queueType: "RANKED_SOLO_5x5" },
    orderBy: { capturedAt: "desc" },
  });
  const stats = buildQueueStats(soloSnapshotsDesc);
  if (!stats) return undefined;

  const soloSnapshotsAsc = [...soloSnapshotsDesc].reverse();
  const peak = peakRank(soloSnapshotsDesc);

  const soloMatchesDesc = await prisma.matchParticipation.findMany({
    where: { accountId, match: { queueId: 420 } },
    include: { match: true },
    orderBy: { match: { gameCreation: "desc" } },
    take: 10,
  });

  const recentChampions = soloMatchesDesc
    .slice(0, 5)
    .map((m) => `${m.championName} (${m.win ? "victoria" : "derrota"}, ${m.kills}/${m.deaths}/${m.assists})`)
    .join(", ");

  const headToHead = await getHeadToHeadRecords(accountId);
  const rivalries = headToHead
    .map((r) => `contra ${r.rivalGameName}#${r.rivalTagLine}: ${r.wins}W-${r.losses}L`)
    .join("; ");

  const facts = [
    `Rango actual: ${tierLabel(stats.tier, stats.rank)}, ${stats.leaguePoints} LP.`,
    `Récord: ${stats.wins}W ${stats.losses}L (${winrate(stats.wins, stats.losses)} winrate).`,
    peak ? `Rango máximo alcanzado: ${tierLabel(peak.tier, peak.rank)}.` : "",
    totalLpGained(soloSnapshotsAsc) !== undefined
      ? `LP ganado desde que se trackea: ${totalLpGained(soloSnapshotsAsc)}.`
      : "",
    winStreak(soloMatchesDesc) > 0 ? `Racha actual: ${winStreak(soloMatchesDesc)} victorias seguidas.` : "",
    lossStreak(soloMatchesDesc) > 0 ? `Racha actual: ${lossStreak(soloMatchesDesc)} derrotas seguidas.` : "",
    recentChampions ? `Últimas partidas: ${recentChampions}.` : "Todavía no tiene partidas registradas.",
    rivalries ? `Head-to-head con amigos: ${rivalries}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return generateRoast(
    `${ANALYSIS_STYLE_GUIDE} Datos reales de ${gameName}#${tagLine} en Solo/Dúo: ${facts} Escribí el análisis en 2 o 3 frases (máximo 55 palabras en total), sin comillas, sin emojis, sin encabezados.`
  );
}

async function main() {
  const accounts = await prisma.trackedAccount.findMany();

  for (const account of accounts) {
    try {
      const text = await buildAnalysis(account.id, account.gameName, account.tagLine);
      if (!text) {
        console.log(`Skipped ${account.gameName}#${account.tagLine}: no data or generation failed`);
        continue;
      }

      await prisma.playerAnalysis.upsert({
        where: { accountId: account.id },
        update: { text, generatedAt: new Date() },
        create: { accountId: account.id, text },
      });

      console.log(`Analyzed ${account.gameName}#${account.tagLine}: ${text}`);
    } catch (err) {
      console.error(`Failed to analyze ${account.gameName}#${account.tagLine}:`, err);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

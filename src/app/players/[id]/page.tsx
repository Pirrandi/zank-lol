import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLpScore } from "@/lib/rank-order";
import { buildQueueStats, buildPeak, buildMilestones } from "@/lib/queue-stats";
import { winStreak, totalLpGained } from "@/lib/derive";
import { getHeadToHeadRecords } from "@/lib/head-to-head";
import { getChampionIconUrl, getChampionSplashUrl, getChampionDisplayName, getProfileIconUrl } from "@/lib/ddragon";
import { getChampionMasteries, getLeagueOfGraphsUrl } from "@/lib/riot";
import { formatRelativeTime, formatDateTime } from "@/lib/relative-time";
import { getSyncStatus } from "@/lib/sync-status";
import { TIER_COLORS } from "@/lib/tier-colors";
import { Nav } from "@/app/nav";
import { ProfileClient, type FullQueueData, type MatchRow } from "./profile-client";

export const dynamic = "force-dynamic";

const QUEUE_IDS: Record<string, number> = {
  RANKED_SOLO_5x5: 420,
  RANKED_FLEX_SR: 440,
};

const QUEUE_LABELS: Record<number, string> = {
  420: "Solo/Dúo",
  440: "Flexible",
};

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ queue?: string }>;
}) {
  const { id } = await params;
  const { queue: queueParam } = await searchParams;
  const initialQueue: "solo" | "flex" = queueParam === "flex" ? "flex" : "solo";

  const account = await prisma.trackedAccount.findUnique({
    where: { id },
    include: {
      snapshots: { orderBy: { capturedAt: "desc" } },
      participations: { include: { match: true } },
      analysis: true,
    },
  });

  if (!account) notFound();

  const participationsDesc = [...account.participations].sort(
    (a, b) => b.match.gameCreation.getTime() - a.match.gameCreation.getTime()
  );

  function buildQueueData(queueType: string): FullQueueData {
    const snapshotsDesc = account!.snapshots.filter((s) => s.queueType === queueType);
    const stats = buildQueueStats(snapshotsDesc);
    const ascending = [...snapshotsDesc].reverse();
    const historyPoints = ascending.map((s) => ({
      capturedAt: s.capturedAt.toISOString(),
      lpScore: getLpScore(s),
      tier: s.tier,
      rank: s.rank,
      leaguePoints: s.leaguePoints,
    }));
    const peakSnapshot = buildPeak(snapshotsDesc);
    const peak = peakSnapshot
      ? { tier: peakSnapshot.tier, rank: peakSnapshot.rank, leaguePoints: peakSnapshot.leaguePoints }
      : undefined;
    const rawMilestones = buildMilestones(snapshotsDesc);
    const milestones = rawMilestones.map((m, i) => ({
      capturedAt: m.capturedAt.toISOString(),
      label: i === 0 ? "Primera partida clasificatoria" : `Alcanzó ${TIER_COLORS[m.tier]?.label ?? m.tier}`,
    }));
    const queueMatches = participationsDesc.filter((p) => p.match.queueId === QUEUE_IDS[queueType]);

    return {
      stats,
      historyPoints,
      peak,
      milestones,
      hasMatchData: queueMatches.length > 0,
      winStreakCount: winStreak(queueMatches),
      totalLpGained: totalLpGained(ascending),
    };
  }

  const solo = buildQueueData("RANKED_SOLO_5x5");
  const flex = buildQueueData("RANKED_FLEX_SR");

  const uniqueChampionIds = [...new Set(participationsDesc.map((p) => p.championId))];
  const iconEntries = await Promise.all(
    uniqueChampionIds.map(async (championId) => [championId, await getChampionIconUrl(championId)] as const)
  );
  const iconByChampionId = new Map(iconEntries);

  const matchIds = participationsDesc.map((p) => p.matchId);
  const friendParticipations = matchIds.length
    ? await prisma.matchParticipation.findMany({
        where: { matchId: { in: matchIds }, accountId: { not: id } },
        include: { account: true },
      })
    : [];
  const friendsByMatchId = new Map<string, typeof friendParticipations>();
  for (const fp of friendParticipations) {
    const list = friendsByMatchId.get(fp.matchId) ?? [];
    list.push(fp);
    friendsByMatchId.set(fp.matchId, list);
  }

  const predictionRounds = matchIds.length
    ? await prisma.predictionRound.findMany({
        where: { matchId: { in: matchIds }, status: "resolved" },
        include: { predictions: true },
      })
    : [];
  const betsByMatchId = new Map<string, { count: number; total: number }>();
  for (const round of predictionRounds) {
    if (!round.matchId) continue;
    const existing = betsByMatchId.get(round.matchId) ?? { count: 0, total: 0 };
    existing.count += round.predictions.length;
    existing.total += round.predictions.reduce((sum, p) => sum + p.amount, 0);
    betsByMatchId.set(round.matchId, existing);
  }

  const matches: MatchRow[] = participationsDesc.map((p) => ({
    matchId: p.matchId,
    championName: p.championName,
    iconUrl: iconByChampionId.get(p.championId),
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    win: p.win,
    queueLabel: QUEUE_LABELS[p.match.queueId] ?? "Otra",
    when: formatRelativeTime(p.match.gameCreation),
    playedAt: formatDateTime(p.match.gameCreation),
    friends: (friendsByMatchId.get(p.matchId) ?? []).map((fp) => ({
      gameName: fp.account.gameName,
      tagLine: fp.account.tagLine,
      sameTeam: fp.teamId === p.teamId,
    })),
    bets: betsByMatchId.get(p.matchId),
  }));

  const headToHead = await getHeadToHeadRecords(id);

  const mostRecent = await prisma.rankSnapshot.aggregate({ _max: { capturedAt: true } });
  const { syncedAgoText, nextSyncText } = getSyncStatus(mostRecent._max.capturedAt ?? undefined);

  let bannerUrl: string | undefined;
  let bannerChampionName: string | undefined;
  try {
    const [topMastery] = await getChampionMasteries(account.puuid, account.platform, 1);
    if (topMastery) {
      bannerUrl = await getChampionSplashUrl(topMastery.championId);
      bannerChampionName = await getChampionDisplayName(topMastery.championId);
    }
  } catch (err) {
    // Banner is a nice-to-have — never let a Riot/Data Dragon hiccup break the profile page.
    console.error(`Failed to build profile banner for ${account.gameName}#${account.tagLine}:`, err);
  }

  const leagueOfGraphsUrl = getLeagueOfGraphsUrl(account.gameName, account.tagLine, account.platform);

  return (
    <>
      <Nav isHome={false} syncedAgoText={syncedAgoText} nextSyncText={nextSyncText} />
      <ProfileClient
        gameName={account.gameName}
        tagLine={account.tagLine}
        profileIconUrl={account.profileIconId !== null ? await getProfileIconUrl(account.profileIconId) : undefined}
        inGame={account.inGame}
        analysisText={account.analysis?.text}
        solo={solo}
        flex={flex}
        initialQueue={initialQueue}
        matches={matches}
        headToHead={headToHead}
        bannerUrl={bannerUrl}
        bannerChampionName={bannerChampionName}
        leagueOfGraphsUrl={leagueOfGraphsUrl}
      />
    </>
  );
}

import type { RankSnapshot } from "@prisma/client";
import { getLpScore } from "./rank-order";
import { lpDeltaToday, rankMove as computeRankMove, peakRank, milestones as computeMilestones, totalLpGained } from "./derive";

export type QueueStats = {
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  lpScore: number;
  delta: number | undefined;
  totalLpGained: number | undefined;
  rankMove: number;
  hotStreak: boolean;
};

export function buildQueueStats(snapshotsDesc: RankSnapshot[]): QueueStats | undefined {
  if (snapshotsDesc.length === 0) return undefined;
  const ascending = [...snapshotsDesc].reverse();
  const latestIndex = ascending.length - 1;
  const latest = ascending[latestIndex];

  return {
    tier: latest.tier,
    rank: latest.rank,
    leaguePoints: latest.leaguePoints,
    wins: latest.wins,
    losses: latest.losses,
    lpScore: getLpScore(latest),
    delta: lpDeltaToday(ascending),
    totalLpGained: totalLpGained(ascending),
    rankMove: computeRankMove(ascending, latestIndex),
    hotStreak: latest.hotStreak,
  };
}

export function buildPeak(snapshotsDesc: RankSnapshot[]): RankSnapshot | undefined {
  return peakRank(snapshotsDesc);
}

export function buildMilestones(snapshotsDesc: RankSnapshot[]) {
  const ascending = [...snapshotsDesc].reverse();
  return computeMilestones(ascending);
}

export function winrate(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return "—";
  return `${Math.round((wins / total) * 100)}%`;
}

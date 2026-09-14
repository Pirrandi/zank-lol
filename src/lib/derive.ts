import type { MatchParticipation, RankSnapshot } from "@prisma/client";
import { getLpScore, TIERS } from "./rank-order";

function tierIndex(tier: string): number {
  const i = TIERS.indexOf(tier.toUpperCase() as (typeof TIERS)[number]);
  return i === -1 ? 0 : i;
}

export function lpDelta(snapshots: RankSnapshot[], index: number): number | undefined {
  if (index < 1) return undefined;
  return getLpScore(snapshots[index]) - getLpScore(snapshots[index - 1]);
}

export function rankMove(snapshots: RankSnapshot[], index: number): number {
  if (index < 1) return 0;
  return tierIndex(snapshots[index].tier) - tierIndex(snapshots[index - 1].tier);
}

export function peakRank(snapshots: RankSnapshot[]): RankSnapshot | undefined {
  if (snapshots.length === 0) return undefined;
  return snapshots.reduce((best, s) => (getLpScore(s) > getLpScore(best) ? s : best));
}

export function lpDeltaToday(snapshotsAscending: RankSnapshot[]): number | undefined {
  if (snapshotsAscending.length < 2) return undefined;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const latest = snapshotsAscending[snapshotsAscending.length - 1];
  const beforeToday = snapshotsAscending.filter((s) => s.capturedAt < startOfDay);
  const baseline = beforeToday.length > 0 ? beforeToday[beforeToday.length - 1] : snapshotsAscending[0];
  if (baseline === latest) return undefined;

  return getLpScore(latest) - getLpScore(baseline);
}

export function totalLpGained(snapshotsAscending: RankSnapshot[]): number | undefined {
  if (snapshotsAscending.length < 2) return undefined;
  const first = snapshotsAscending[0];
  const last = snapshotsAscending[snapshotsAscending.length - 1];
  return getLpScore(last) - getLpScore(first);
}

export type Milestone = {
  capturedAt: Date;
  tier: string;
};

export function milestones(snapshotsAscending: RankSnapshot[]): Milestone[] {
  const out: Milestone[] = [];
  let lastTier: string | undefined;
  for (const s of snapshotsAscending) {
    if (s.tier !== lastTier) {
      out.push({ capturedAt: s.capturedAt, tier: s.tier });
      lastTier = s.tier;
    }
  }
  return out;
}

export function winStreak(matchesDesc: MatchParticipation[]): number {
  let streak = 0;
  for (const m of matchesDesc) {
    if (!m.win) break;
    streak++;
  }
  return streak;
}

export function lossStreak(matchesDesc: MatchParticipation[]): number {
  let streak = 0;
  for (const m of matchesDesc) {
    if (m.win) break;
    streak++;
  }
  return streak;
}

export type LpDropResult = {
  latest: RankSnapshot;
  reference: RankSnapshot;
  delta: number;
};

/**
 * Compares the latest snapshot against the earliest snapshot still within the
 * last `windowMs` (i.e. the snapshot closest to `windowMs` ago without being
 * more than `windowMs` old). Returns undefined if there isn't at least one
 * other snapshot inside that window to compare against.
 */
export function lpDropOverWindow(
  snapshotsAsc: RankSnapshot[],
  windowMs: number,
  now: number = Date.now()
): LpDropResult | undefined {
  if (snapshotsAsc.length < 2) return undefined;
  const latest = snapshotsAsc[snapshotsAsc.length - 1];
  const cutoff = now - windowMs;
  const candidates = snapshotsAsc
    .slice(0, -1)
    .filter((s) => s.capturedAt.getTime() >= cutoff);
  if (candidates.length === 0) return undefined;
  const reference = candidates[0];
  return { latest, reference, delta: getLpScore(latest) - getLpScore(reference) };
}

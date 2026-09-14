export const TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;

export const RANKS = ["IV", "III", "II", "I"] as const;

const NO_SUB_RANK_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

export type RankLike = {
  tier: string;
  rank: string;
  leaguePoints: number;
};

function tierIndex(tier: string): number {
  const i = TIERS.indexOf(tier.toUpperCase() as (typeof TIERS)[number]);
  return i === -1 ? 0 : i;
}

function rankIndex(tier: string, rank: string): number {
  if (NO_SUB_RANK_TIERS.has(tier.toUpperCase())) return 0;
  const i = RANKS.indexOf(rank.toUpperCase() as (typeof RANKS)[number]);
  return i === -1 ? 0 : i;
}

export function getLpScore(entry: RankLike): number {
  return tierIndex(entry.tier) * 400 + rankIndex(entry.tier, entry.rank) * 100 + entry.leaguePoints;
}

export function divisionIndex(entry: Pick<RankLike, "tier" | "rank">): number {
  return tierIndex(entry.tier) * 4 + rankIndex(entry.tier, entry.rank);
}

export function compareRank(a: RankLike, b: RankLike): number {
  return getLpScore(b) - getLpScore(a);
}

export function compareRankNullable(
  a: RankLike | undefined,
  b: RankLike | undefined
): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return compareRank(a, b);
}

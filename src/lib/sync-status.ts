export const POLL_INTERVAL_MINUTES = 5;

export function getSyncStatus(mostRecentCapturedAt: Date | undefined): {
  syncedAgoText: string;
  nextSyncText: string;
} {
  if (!mostRecentCapturedAt) {
    return { syncedAgoText: "nunca", nextSyncText: "desconocido" };
  }
  const minutesAgo = Math.max(
    0,
    Math.floor((Date.now() - mostRecentCapturedAt.getTime()) / 60000)
  );
  const nextIn = Math.max(0, POLL_INTERVAL_MINUTES - (minutesAgo % POLL_INTERVAL_MINUTES));
  return {
    syncedAgoText: `hace ${minutesAgo}m`,
    nextSyncText: `${nextIn}m`,
  };
}

const TIER_ABBREV: Record<string, string> = {
  IRON: "HI",
  BRONZE: "BR",
  SILVER: "PA",
  GOLD: "OR",
  PLATINUM: "PL",
  EMERALD: "ES",
  DIAMOND: "DI",
  MASTER: "MA",
  GRANDMASTER: "GM",
  CHALLENGER: "RE",
};

export function getTierSpreadText(tiers: string[]): string {
  if (tiers.length === 0) return "—";
  const order = [
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
  ];
  const indices = tiers.map((t) => order.indexOf(t.toUpperCase())).filter((i) => i !== -1);
  if (indices.length === 0) return "—";
  const highest = order[Math.max(...indices)];
  const lowest = order[Math.min(...indices)];
  if (highest === lowest) return TIER_ABBREV[highest];
  return `${TIER_ABBREV[highest]} → ${TIER_ABBREV[lowest]}`;
}

export const TIER_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  IRON: { bg: "rgba(139, 147, 160, 0.14)", fg: "#9aa0ac", label: "Hierro" },
  BRONZE: { bg: "rgba(201, 138, 75, 0.14)", fg: "#c98a4b", label: "Bronce" },
  SILVER: { bg: "rgba(199, 205, 214, 0.14)", fg: "#c7cdd6", label: "Plata" },
  GOLD: { bg: "rgba(212, 160, 23, 0.16)", fg: "#d4a017", label: "Oro" },
  PLATINUM: { bg: "rgba(77, 217, 192, 0.16)", fg: "#4dd9c0", label: "Platino" },
  EMERALD: { bg: "rgba(52, 211, 153, 0.16)", fg: "#34d399", label: "Esmeralda" },
  DIAMOND: { bg: "rgba(94, 177, 245, 0.16)", fg: "#5eb1f5", label: "Diamante" },
  MASTER: { bg: "rgba(192, 132, 252, 0.16)", fg: "#c084fc", label: "Maestro" },
  GRANDMASTER: { bg: "rgba(255, 77, 99, 0.16)", fg: "#ff4d63", label: "Gran Maestro" },
  CHALLENGER: { bg: "rgba(125, 211, 252, 0.18)", fg: "#7dd3fc", label: "Retador" },
};

export const UNRANKED_COLOR = { bg: "rgba(122, 128, 144, 0.12)", fg: "#7a8090", label: "Sin Rango" };

export const WIN_COLOR = "#22c55e";
export const LOSS_COLOR = "#FF2D55";
export const FLAT_COLOR = "#7a8090";

const NO_SUB_RANK_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

const EMBLEM_TIER_SLUGS = new Set([
  "iron",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "emerald",
  "diamond",
  "master",
  "grandmaster",
  "challenger",
]);

export function tierLabel(tier: string, rank: string): string {
  const meta = TIER_COLORS[tier.toUpperCase()];
  if (!meta) return tier;
  return NO_SUB_RANK_TIERS.has(tier.toUpperCase()) ? meta.label : `${meta.label} ${rank}`;
}

export function tierEmblemUrl(tier: string): string | undefined {
  const slug = tier.toLowerCase();
  if (!EMBLEM_TIER_SLUGS.has(slug)) return undefined;
  return `/emblems/${slug}.png`;
}

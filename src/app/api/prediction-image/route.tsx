import { ImageResponse } from "next/og";
import { getChampionIconUrl } from "@/lib/ddragon";
import { loadArchivoFont } from "@/lib/og-font";
import { TIER_COLORS, UNRANKED_COLOR, tierLabel, tierEmblemUrl } from "@/lib/tier-colors";

const ICON_SIZE = 118;
const ICON_GAP = 18;
const ACCENT = "#E9FF1F";

type PlayerInfo = {
  championId: number;
  tracked: boolean;
  name?: string;
  tag?: string;
  tier?: string;
  rank?: string;
  lp?: number;
};

function parseChampionIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
}

function parsePlayers(raw: string | null): Map<number, PlayerInfo> {
  if (!raw) return new Map();
  try {
    const list = JSON.parse(raw) as PlayerInfo[];
    return new Map(list.map((p) => [p.championId, p]));
  } catch {
    return new Map();
  }
}

async function resolveIcons(championIds: number[]): Promise<(string | undefined)[]> {
  return Promise.all(championIds.map((id) => getChampionIconUrl(id)));
}

function NamePlate({ player }: { player: PlayerInfo }) {
  const meta = player.tier ? TIER_COLORS[player.tier.toUpperCase()] : undefined;
  const color = meta?.fg ?? ACCENT;
  return (
    <div
      style={{
        display: "flex",
        fontSize: 14,
        fontWeight: 800,
        color,
        padding: "3px 10px",
        borderRadius: 999,
        border: `1.5px solid ${color}`,
        background: "rgba(11,12,16,0.85)",
        maxWidth: ICON_SIZE + 24,
        overflow: "hidden",
        whiteSpace: "nowrap",
      }}
    >
      {player.name}
    </div>
  );
}

function RankTag({ player, origin }: { player: PlayerInfo; origin: string }) {
  if (!player.tier || !player.rank) {
    return <div style={{ display: "flex", fontSize: 10, color: "#5a5f6b" }}>Sin rango</div>;
  }
  const meta = TIER_COLORS[player.tier.toUpperCase()] ?? UNRANKED_COLOR;
  const emblemPath = tierEmblemUrl(player.tier);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {emblemPath && <img src={`${origin}${emblemPath}`} width={16} height={16} />}
      <div style={{ display: "flex", fontSize: 11, fontWeight: 700, color: meta.fg }}>
        {tierLabel(player.tier, player.rank)}
        {player.lp !== undefined ? ` · ${player.lp}LP` : ""}
      </div>
    </div>
  );
}

function ChampionColumn({
  iconUrl,
  player,
  origin,
}: {
  iconUrl: string | undefined;
  player: PlayerInfo | undefined;
  origin: string;
}) {
  const highlighted = !!player?.tracked;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: ICON_SIZE, gap: 6 }}>
      <div style={{ display: "flex", height: 24, alignItems: "flex-end" }}>
        {highlighted && <NamePlate player={player!} />}
      </div>
      <div
        style={{
          display: "flex",
          width: ICON_SIZE,
          height: ICON_SIZE,
          borderRadius: 18,
          overflow: "hidden",
          border: highlighted ? `4px solid ${ACCENT}` : "2px solid rgba(255,255,255,0.10)",
          background: "#16181d",
          opacity: highlighted ? 1 : 0.55,
          ...(highlighted ? { boxShadow: "0 0 0 5px rgba(233,255,31,0.16), 0 6px 18px rgba(0,0,0,0.5)" } : {}),
        }}
      >
        {iconUrl && (
          <img src={iconUrl} width={ICON_SIZE} height={ICON_SIZE} style={{ objectFit: "cover" }} />
        )}
      </div>
      <div style={{ display: "flex", height: 18, alignItems: "flex-start" }}>
        {player && <RankTag player={player} origin={origin} />}
      </div>
    </div>
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = new URL(request.url).origin;
  const team1Ids = parseChampionIds(searchParams.get("team1"));
  const team2Ids = parseChampionIds(searchParams.get("team2"));
  const playersByChampion = parsePlayers(searchParams.get("players"));
  const queue = searchParams.get("queue") ?? "Ranked";
  const kicker = searchParams.get("kicker") ?? "¿Gana o pierde?";

  const [team1Icons, team2Icons, font] = await Promise.all([
    resolveIcons(team1Ids),
    resolveIcons(team2Ids),
    loadArchivoFont(),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1000px",
          height: "560px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "linear-gradient(160deg, #101218 0%, #0b0c10 55%, #0a0b0f 100%)",
          fontFamily: "Archivo",
          padding: "34px 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
          <div
            style={{
              display: "flex",
              fontSize: 13,
              fontWeight: 800,
              color: "#0b0c10",
              background: ACCENT,
              padding: "5px 14px",
              borderRadius: 999,
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            {queue}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 800,
              color: "#f5f6f8",
              letterSpacing: "1px",
            }}
          >
            {kicker}
          </div>
        </div>

        <div style={{ display: "flex", gap: ICON_GAP }}>
          {team1Ids.map((championId, i) => (
            <ChampionColumn
              key={`t1-${i}`}
              iconUrl={team1Icons[i]}
              player={playersByChampion.get(championId)}
              origin={origin}
            />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: `2px solid ${ACCENT}`,
            background: "#101218",
            color: ACCENT,
            fontSize: 18,
            fontWeight: 800,
            margin: "14px 0",
            boxShadow: "0 0 20px rgba(233,255,31,0.25)",
          }}
        >
          VS
        </div>

        <div style={{ display: "flex", gap: ICON_GAP }}>
          {team2Ids.map((championId, i) => (
            <ChampionColumn
              key={`t2-${i}`}
              iconUrl={team2Icons[i]}
              player={playersByChampion.get(championId)}
              origin={origin}
            />
          ))}
        </div>
      </div>
    ),
    {
      width: 1000,
      height: 560,
      fonts: [{ name: "Archivo", data: font, weight: 800, style: "normal" }],
    }
  );
}

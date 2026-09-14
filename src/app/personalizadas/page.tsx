import Link from "next/link";
import { getCustomMatchups } from "@/lib/customs";
import { getChampionIconUrl } from "@/lib/ddragon";
import { formatDateTime } from "@/lib/relative-time";
import { getSyncStatus } from "@/lib/sync-status";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/app/nav";

export const dynamic = "force-dynamic";

function TeamSide({
  team,
  won,
  icons,
}: {
  team: { accountId: string; gameName: string; tagLine: string; championName: string; championId: number }[];
  won: boolean;
  icons: Map<number, string | undefined>;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
      {team.map((p) => {
        const icon = icons.get(p.championId);
        return (
          <Link
            key={p.accountId}
            href={`/players/${p.accountId}`}
            style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}
          >
            {icon ? (
              <img src={icon} alt={p.championName} width={32} height={32} style={{ borderRadius: "50%", flex: "none" }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--color-neutral-200)", flex: "none" }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: won ? "var(--color-win)" : "var(--color-text)" }}>
                {p.gameName}
                <span style={{ color: "var(--color-neutral-500)", fontWeight: 400 }}>#{p.tagLine}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{p.championName}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default async function CustomsPage() {
  const matchups = await getCustomMatchups();

  const championIds = new Set<number>();
  for (const m of matchups) {
    for (const p of [...m.teamA, ...m.teamB]) championIds.add(p.championId);
  }
  const iconEntries = await Promise.all(
    [...championIds].map(async (id) => [id, await getChampionIconUrl(id)] as const)
  );
  const icons = new Map(iconEntries);

  const mostRecent = await prisma.rankSnapshot.aggregate({ _max: { capturedAt: true } });
  const { syncedAgoText, nextSyncText } = getSyncStatus(mostRecent._max.capturedAt ?? undefined);

  return (
    <>
      <Nav isHome={false} isCustoms syncedAgoText={syncedAgoText} nextSyncText={nextSyncText} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 72px" }}>
        <div style={{ marginBottom: 8, color: "var(--color-accent)", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Partidas Personalizadas
        </div>
        <h1 style={{ fontSize: 36, margin: "0 0 8px" }}>1vs1 y personalizadas</h1>
        <p style={{ color: "var(--color-neutral-600)", fontSize: 15, marginBottom: 32, maxWidth: 560 }}>
          Cada vez que dos o más del grupo terminan en equipos rivales dentro de una partida personalizada, cae acá solo.
        </p>

        {matchups.length === 0 && (
          <div className="card" style={{ padding: "24px 20px", color: "var(--color-neutral-600)", fontSize: 14 }}>
            Todavía no hay personalizadas registradas entre ustedes. Jueguen una y en el próximo sync aparece.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {matchups.map((m) => {
            const teamAWon = m.teamA[0]?.win ?? false;
            return (
              <div key={m.matchId} className="card" style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span className="tag" style={{ background: "var(--color-surface)", color: "var(--color-accent)", borderColor: "var(--color-accent)" }}>
                    {m.label}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{formatDateTime(m.gameCreation)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <TeamSide team={m.teamA} won={teamAWon} icons={icons} />
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--color-neutral-500)" }}>VS</div>
                  <TeamSide team={m.teamB} won={!teamAWon} icons={icons} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

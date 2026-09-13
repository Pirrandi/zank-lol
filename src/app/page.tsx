import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { compareRankNullable, type RankLike } from "@/lib/rank-order";

export const dynamic = "force-dynamic";

type QueueStats = RankLike & {
  wins: number;
  losses: number;
  hotStreak: boolean;
};

function winrate(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return "0%";
  return `${Math.round((wins / total) * 100)}%`;
}

export default async function HomePage() {
  const accounts = await prisma.trackedAccount.findMany({
    include: {
      snapshots: {
        orderBy: { capturedAt: "desc" },
      },
    },
  });

  const rows = accounts.map((account) => {
    const queues: Record<string, QueueStats> = {};

    for (const snapshot of account.snapshots) {
      if (queues[snapshot.queueType]) continue;
      queues[snapshot.queueType] = {
        tier: snapshot.tier,
        rank: snapshot.rank,
        leaguePoints: snapshot.leaguePoints,
        wins: snapshot.wins,
        losses: snapshot.losses,
        hotStreak: false,
      };
    }

    return {
      id: account.id,
      gameName: account.gameName,
      tagLine: account.tagLine,
      solo: queues.RANKED_SOLO_5x5,
    };
  });

  rows.sort((a, b) => compareRankNullable(a.solo, b.solo));

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "1.75rem", letterSpacing: "0.02em" }}>
        zank.lol <span style={{ color: "#8b949e" }}>ranked ladder</span>
      </h1>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1.5rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #30363d", color: "#8b949e", textAlign: "left" }}>
            <th style={{ padding: "0.5rem" }}>#</th>
            <th style={{ padding: "0.5rem" }}>Summoner</th>
            <th style={{ padding: "0.5rem" }}>Rank</th>
            <th style={{ padding: "0.5rem" }}>LP</th>
            <th style={{ padding: "0.5rem" }}>W/L</th>
            <th style={{ padding: "0.5rem" }}>Winrate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} style={{ borderBottom: "1px solid #21262d" }}>
              <td style={{ padding: "0.5rem" }}>{i + 1}</td>
              <td style={{ padding: "0.5rem" }}>
                <Link href={`/players/${row.id}`} style={{ color: "#58a6ff" }}>
                  {row.gameName}#{row.tagLine}
                </Link>
              </td>
              <td style={{ padding: "0.5rem" }}>
                {row.solo ? (
                  <>
                    {row.solo.tier} {row.solo.rank}
                    {row.solo.hotStreak ? " 🔥" : ""}
                  </>
                ) : (
                  <span style={{ color: "#8b949e" }}>Unranked</span>
                )}
              </td>
              <td style={{ padding: "0.5rem" }}>{row.solo?.leaguePoints ?? "-"}</td>
              <td style={{ padding: "0.5rem" }}>
                {row.solo ? `${row.solo.wins}W ${row.solo.losses}L` : "-"}
              </td>
              <td style={{ padding: "0.5rem" }}>
                {row.solo ? winrate(row.solo.wins, row.solo.losses) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

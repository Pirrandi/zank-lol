import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLpScore } from "@/lib/rank-order";
import { LpChart } from "./lp-chart";

export const dynamic = "force-dynamic";

function winrate(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return "0%";
  return `${Math.round((wins / total) * 100)}%`;
}

const QUEUE_LABELS: Record<string, string> = {
  RANKED_SOLO_5x5: "Solo/Duo",
  RANKED_FLEX_SR: "Flex",
};

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const account = await prisma.trackedAccount.findUnique({
    where: { id },
    include: {
      snapshots: {
        orderBy: { capturedAt: "desc" },
      },
    },
  });

  if (!account) notFound();

  const latestByQueue: Record<string, (typeof account.snapshots)[number]> = {};
  for (const snapshot of account.snapshots) {
    if (!latestByQueue[snapshot.queueType]) {
      latestByQueue[snapshot.queueType] = snapshot;
    }
  }

  const soloHistory = account.snapshots
    .filter((s) => s.queueType === "RANKED_SOLO_5x5")
    .slice()
    .reverse()
    .map((s) => ({
      capturedAt: s.capturedAt.toISOString(),
      tier: s.tier,
      rank: s.rank,
      leaguePoints: s.leaguePoints,
      lpScore: getLpScore(s),
    }));

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
      <a href="/" style={{ color: "#58a6ff" }}>
        &larr; back to ladder
      </a>
      <h1 style={{ fontSize: "1.75rem", marginTop: "0.5rem" }}>
        {account.gameName}#{account.tagLine}
      </h1>

      <div style={{ display: "flex", gap: "2rem", marginTop: "1.5rem" }}>
        {Object.entries(latestByQueue).map(([queueType, snapshot]) => (
          <div key={queueType}>
            <div style={{ color: "#8b949e", fontSize: "0.85rem" }}>
              {QUEUE_LABELS[queueType] ?? queueType}
            </div>
            <div style={{ fontSize: "1.1rem" }}>
              {snapshot.tier} {snapshot.rank} - {snapshot.leaguePoints} LP
            </div>
            <div style={{ color: "#8b949e" }}>
              {snapshot.wins}W {snapshot.losses}L ({winrate(snapshot.wins, snapshot.losses)})
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: "2rem", fontSize: "1.25rem" }}>Solo/Duo LP over time</h2>
      <LpChart data={soloHistory} />

      <h2 style={{ marginTop: "2rem", fontSize: "1.25rem" }}>Snapshots</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #30363d", color: "#8b949e", textAlign: "left" }}>
            <th style={{ padding: "0.5rem" }}>Date</th>
            <th style={{ padding: "0.5rem" }}>Queue</th>
            <th style={{ padding: "0.5rem" }}>Rank</th>
            <th style={{ padding: "0.5rem" }}>LP</th>
            <th style={{ padding: "0.5rem" }}>W/L</th>
          </tr>
        </thead>
        <tbody>
          {account.snapshots.map((snapshot) => (
            <tr key={snapshot.id} style={{ borderBottom: "1px solid #21262d" }}>
              <td style={{ padding: "0.5rem" }}>
                {snapshot.capturedAt.toLocaleString()}
              </td>
              <td style={{ padding: "0.5rem" }}>
                {QUEUE_LABELS[snapshot.queueType] ?? snapshot.queueType}
              </td>
              <td style={{ padding: "0.5rem" }}>
                {snapshot.tier} {snapshot.rank}
              </td>
              <td style={{ padding: "0.5rem" }}>{snapshot.leaguePoints}</td>
              <td style={{ padding: "0.5rem" }}>
                {snapshot.wins}W {snapshot.losses}L
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

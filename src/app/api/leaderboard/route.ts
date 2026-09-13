import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compareRankNullable, type RankLike } from "@/lib/rank-order";

type QueueStats = RankLike & {
  wins: number;
  losses: number;
  hotStreak: boolean;
  capturedAt: Date;
};

export async function GET() {
  const accounts = await prisma.trackedAccount.findMany({
    include: {
      snapshots: {
        orderBy: { capturedAt: "desc" },
      },
    },
  });

  const leaderboard = accounts.map((account) => {
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
        capturedAt: snapshot.capturedAt,
      };
    }

    return {
      id: account.id,
      gameName: account.gameName,
      tagLine: account.tagLine,
      queues,
    };
  });

  leaderboard.sort((a, b) =>
    compareRankNullable(a.queues.RANKED_SOLO_5x5, b.queues.RANKED_SOLO_5x5)
  );

  return NextResponse.json(leaderboard);
}

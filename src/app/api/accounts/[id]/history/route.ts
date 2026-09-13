import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLpScore } from "@/lib/rank-order";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const queueType = request.nextUrl.searchParams.get("queue") ?? "RANKED_SOLO_5x5";

  const snapshots = await prisma.rankSnapshot.findMany({
    where: { accountId: id, queueType },
    orderBy: { capturedAt: "asc" },
  });

  const history = snapshots.map((snapshot) => ({
    ...snapshot,
    lpScore: getLpScore(snapshot),
  }));

  return NextResponse.json(history);
}

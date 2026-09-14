import { prisma } from "./prisma";

export type FameHighlight = {
  id: string;
  gameName: string;
  tagLine: string;
  championName: string;
  value: number;
};

export async function getBiggestPentaKill(): Promise<FameHighlight | undefined> {
  const row = await prisma.matchParticipation.findFirst({
    where: { pentaKills: { gt: 0 } },
    include: { account: true },
    orderBy: { match: { gameCreation: "desc" } },
  });
  if (!row) return undefined;
  return {
    id: row.accountId,
    gameName: row.account.gameName,
    tagLine: row.account.tagLine,
    championName: row.championName,
    value: row.pentaKills,
  };
}

export async function getTopTripleKills(): Promise<FameHighlight | undefined> {
  const grouped = await prisma.matchParticipation.groupBy({
    by: ["accountId"],
    _sum: { tripleKills: true },
    orderBy: { _sum: { tripleKills: "desc" } },
    take: 1,
  });
  const top = grouped[0];
  if (!top || !top._sum.tripleKills || top._sum.tripleKills === 0) return undefined;

  const account = await prisma.trackedAccount.findUnique({ where: { id: top.accountId } });
  if (!account) return undefined;

  const bestMatch = await prisma.matchParticipation.findFirst({
    where: { accountId: top.accountId, tripleKills: { gt: 0 } },
    orderBy: { tripleKills: "desc" },
  });

  return {
    id: account.id,
    gameName: account.gameName,
    tagLine: account.tagLine,
    championName: bestMatch?.championName ?? "",
    value: top._sum.tripleKills,
  };
}

export async function getTopEpicSteals(): Promise<FameHighlight | undefined> {
  const grouped = await prisma.matchParticipation.groupBy({
    by: ["accountId"],
    _sum: { epicSteals: true },
    orderBy: { _sum: { epicSteals: "desc" } },
    take: 1,
  });
  const top = grouped[0];
  if (!top || !top._sum.epicSteals || top._sum.epicSteals === 0) return undefined;

  const account = await prisma.trackedAccount.findUnique({ where: { id: top.accountId } });
  if (!account) return undefined;

  const bestMatch = await prisma.matchParticipation.findFirst({
    where: { accountId: top.accountId, epicSteals: { gt: 0 } },
    orderBy: { epicSteals: "desc" },
  });

  return {
    id: account.id,
    gameName: account.gameName,
    tagLine: account.tagLine,
    championName: bestMatch?.championName ?? "",
    value: top._sum.epicSteals,
  };
}

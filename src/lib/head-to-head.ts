import { prisma } from "./prisma";

export type HeadToHeadRecord = {
  rivalId: string;
  rivalGameName: string;
  rivalTagLine: string;
  wins: number;
  losses: number;
};

export async function getHeadToHeadRecords(accountId: string): Promise<HeadToHeadRecord[]> {
  const own = await prisma.matchParticipation.findMany({
    where: { accountId },
    select: { matchId: true, teamId: true, win: true },
  });
  if (own.length === 0) return [];

  const ownByMatch = new Map(own.map((p) => [p.matchId, p]));
  const matchIds = own.map((p) => p.matchId);

  const rivalParticipations = await prisma.matchParticipation.findMany({
    where: { matchId: { in: matchIds }, accountId: { not: accountId } },
    include: { account: true },
  });

  const records = new Map<string, HeadToHeadRecord>();

  for (const rival of rivalParticipations) {
    const ownRow = ownByMatch.get(rival.matchId);
    if (!ownRow) continue;
    if (ownRow.teamId === rival.teamId) continue;

    let record = records.get(rival.accountId);
    if (!record) {
      record = {
        rivalId: rival.accountId,
        rivalGameName: rival.account.gameName,
        rivalTagLine: rival.account.tagLine,
        wins: 0,
        losses: 0,
      };
      records.set(rival.accountId, record);
    }
    if (ownRow.win) record.wins++;
    else record.losses++;
  }

  return Array.from(records.values());
}

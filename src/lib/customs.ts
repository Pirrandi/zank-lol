import { prisma } from "./prisma";

const CUSTOM_GAME_QUEUE_ID = 0;

export type CustomMatchup = {
  matchId: string;
  gameCreation: Date;
  label: string;
  teamA: { accountId: string; gameName: string; tagLine: string; championName: string; championId: number; win: boolean }[];
  teamB: { accountId: string; gameName: string; tagLine: string; championName: string; championId: number; win: boolean }[];
};

export async function getCustomMatchups(): Promise<CustomMatchup[]> {
  const matches = await prisma.match.findMany({
    where: { queueId: CUSTOM_GAME_QUEUE_ID },
    include: { participations: { include: { account: true } } },
    orderBy: { gameCreation: "desc" },
  });

  const matchups: CustomMatchup[] = [];

  for (const match of matches) {
    const teamIds = [...new Set(match.participations.map((p) => p.teamId))];
    if (teamIds.length < 2) continue;

    const [teamAId, teamBId] = teamIds;
    const teamA = match.participations.filter((p) => p.teamId === teamAId);
    const teamB = match.participations.filter((p) => p.teamId === teamBId);
    if (teamA.length === 0 || teamB.length === 0) continue;

    matchups.push({
      matchId: match.id,
      gameCreation: match.gameCreation,
      label: `${teamA.length}v${teamB.length}`,
      teamA: teamA.map((p) => ({
        accountId: p.accountId,
        gameName: p.account.gameName,
        tagLine: p.account.tagLine,
        championName: p.championName,
        championId: p.championId,
        win: p.win,
      })),
      teamB: teamB.map((p) => ({
        accountId: p.accountId,
        gameName: p.account.gameName,
        tagLine: p.account.tagLine,
        championName: p.championName,
        championId: p.championId,
        win: p.win,
      })),
    });
  }

  return matchups;
}

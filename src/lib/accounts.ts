import { prisma } from "./prisma";
import { getAccountByRiotId } from "./riot";

// Shared by scripts/add-account.ts (CLI) and /admin/accounts (web form) so both go through the
// exact same Riot lookup + DB upsert instead of duplicating it.
export async function addTrackedAccount(gameName: string, tagLine: string, platform: string) {
  const account = await getAccountByRiotId(gameName, tagLine);

  return prisma.trackedAccount.upsert({
    where: { puuid: account.puuid },
    update: { gameName: account.gameName, tagLine: account.tagLine },
    create: {
      gameName: account.gameName,
      tagLine: account.tagLine,
      puuid: account.puuid,
      platform,
    },
  });
}

// TrackedAccount is referenced by RankSnapshot, MatchParticipation, PlayerAnalysis and (via the
// separate, in-progress betting feature) PredictionRound/Prediction. Prisma has no cascading
// delete configured on these relations (default is Restrict), so removing an account without
// first clearing its dependents would fail on the FK constraint. This deletes only this
// account's own rows across those tables — it never touches the Prediction/PredictionRound
// *models* or their logic, and never touches Match rows (a Match can belong to several
// accounts' participations, e.g. personalizadas, so it isn't owned by a single account).
export async function deleteTrackedAccountCascade(accountId: string): Promise<void> {
  await prisma.$transaction([
    prisma.prediction.deleteMany({ where: { round: { accountId } } }),
    prisma.predictionRound.deleteMany({ where: { accountId } }),
    prisma.rankSnapshot.deleteMany({ where: { accountId } }),
    prisma.matchParticipation.deleteMany({ where: { accountId } }),
    prisma.playerAnalysis.deleteMany({ where: { accountId } }),
    prisma.trackedAccount.delete({ where: { id: accountId } }),
  ]);
}

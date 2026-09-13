import { PrismaClient } from "@prisma/client";
import { getRankedEntries } from "../src/lib/riot";

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.trackedAccount.findMany();
  let keyExpiredLogged = false;

  for (const account of accounts) {
    try {
      const entries = await getRankedEntries(account.puuid, account.platform);

      for (const entry of entries) {
        await prisma.rankSnapshot.create({
          data: {
            accountId: account.id,
            queueType: entry.queueType,
            tier: entry.tier,
            rank: entry.rank,
            leaguePoints: entry.leaguePoints,
            wins: entry.wins,
            losses: entry.losses,
          },
        });
      }

      console.log(
        `Polled ${account.gameName}#${account.tagLine}: ${entries.length} queue entr${entries.length === 1 ? "y" : "ies"}`
      );
    } catch (err) {
      console.error(`Failed to poll ${account.gameName}#${account.tagLine}:`, err);
      if (!keyExpiredLogged && err instanceof Error && err.message.includes("401")) {
        console.error("RIOT KEY EXPIRED - regenerate at https://developer.riotgames.com/");
        keyExpiredLogged = true;
      }
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

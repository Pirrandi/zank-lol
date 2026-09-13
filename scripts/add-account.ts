import { PrismaClient } from "@prisma/client";
import { getAccountByRiotId } from "../src/lib/riot";

const prisma = new PrismaClient();

async function main() {
  const [gameName, tagLine] = process.argv.slice(2);
  if (!gameName || !tagLine) {
    console.error("Usage: npx tsx scripts/add-account.ts <gameName> <tagLine>");
    process.exit(1);
  }

  const account = await getAccountByRiotId(gameName, tagLine);

  const saved = await prisma.trackedAccount.upsert({
    where: { puuid: account.puuid },
    update: { gameName: account.gameName, tagLine: account.tagLine },
    create: {
      gameName: account.gameName,
      tagLine: account.tagLine,
      puuid: account.puuid,
      platform: "la2",
    },
  });

  console.log(`Tracked account: ${saved.gameName}#${saved.tagLine} (${saved.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

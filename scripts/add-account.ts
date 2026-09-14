import { prisma } from "../src/lib/prisma";
import { addTrackedAccount } from "../src/lib/accounts";

async function main() {
  const [gameName, tagLine] = process.argv.slice(2);
  if (!gameName || !tagLine) {
    console.error("Usage: npx tsx scripts/add-account.ts <gameName> <tagLine>");
    process.exit(1);
  }

  const saved = await addTrackedAccount(gameName, tagLine, "la2");

  console.log(`Tracked account: ${saved.gameName}#${saved.tagLine} (${saved.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

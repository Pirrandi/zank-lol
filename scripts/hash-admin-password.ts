import { hashPassword } from "../src/lib/admin-password";

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error("Usage: npx tsx scripts/hash-admin-password.ts <password>");
    process.exit(1);
  }

  const hash = await hashPassword(password);
  console.log("\nAdd this line to your .env:\n");
  console.log(`ADMIN_PASSWORD_HASH="${hash}"\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

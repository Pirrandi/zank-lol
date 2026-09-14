import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!applicationId || !guildId || !token) {
    console.error(
      "Missing env vars. Required: DISCORD_APPLICATION_ID, DISCORD_GUILD_ID, DISCORD_BOT_TOKEN"
    );
    process.exit(1);
  }

  const accounts = await prisma.trackedAccount.findMany({ orderBy: { gameName: "asc" } });

  if (accounts.length === 0) {
    console.error("No tracked accounts found — nothing to register choices for.");
    process.exit(1);
  }
  if (accounts.length > 25) {
    console.error(`Discord caps choices at 25, found ${accounts.length} accounts.`);
    process.exit(1);
  }

  const command = {
    name: "rank",
    description: "Consultá el rango actual de un invocador en Solo/Dúo",
    options: [
      {
        type: 3, // STRING
        name: "jugador",
        description: "Invocador a consultar",
        required: true,
        choices: accounts.map((a) => ({
          name: `${a.gameName}#${a.tagLine}`,
          value: `${a.gameName}#${a.tagLine}`,
        })),
      },
    ],
  };

  const addCommand = {
    name: "agregar-jugador",
    description: "Agrega una cuenta de LoL al escalafón (solo Admin Zank)",
    default_member_permissions: null,
    options: [
      {
        type: 3, // STRING
        name: "nombre",
        description: "Riot ID (la parte antes del #)",
        required: true,
      },
      {
        type: 3, // STRING
        name: "tag",
        description: "Tag (la parte después del #, sin el #)",
        required: true,
      },
    ],
  };

  const url = `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command, addCommand]),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`Discord API ${res.status}: ${body}`);
    process.exit(1);
  }

  console.log(`Registered guild command(s). Discord response:\n${body}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

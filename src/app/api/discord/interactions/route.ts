import { NextResponse } from "next/server";
import nacl from "tweetnacl";
import { prisma } from "@/lib/prisma";
import { tierLabel } from "@/lib/tier-colors";
import { winrate } from "@/lib/queue-stats";
import { getAccountByRiotId } from "@/lib/riot";
import { placeBet, getOrCreateBettor } from "@/lib/betting";
import { updatePredictionMessageContent } from "@/lib/discord";

const SOLO_QUEUE_TYPE = "RANKED_SOLO_5x5";
const ADMIN_ROLE_ID = "1342180889123098695";
const EPHEMERAL = 64;

type DiscordInteractionOption = {
  name: string;
  value: string;
};

type DiscordModalComponentRow = {
  components: { custom_id: string; value: string }[];
};

type DiscordInteraction = {
  type: number;
  member?: { roles?: string[]; user?: { id: string; username: string } };
  data?: {
    name?: string;
    custom_id?: string;
    options?: DiscordInteractionOption[];
    components?: DiscordModalComponentRow[];
  };
};

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function verifySignature(rawBody: string, signature: string | null, timestamp: string | null): boolean {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey || !signature || !timestamp) return false;

  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(timestamp + rawBody),
      hexToUint8Array(signature),
      hexToUint8Array(publicKey)
    );
  } catch {
    return false;
  }
}

async function buildRankReply(jugador: string): Promise<string> {
  const separatorIndex = jugador.lastIndexOf("#");
  if (separatorIndex === -1) {
    return `No entendí a quién buscás. Usá el formato \`nombre#tag\`.`;
  }
  const gameName = jugador.slice(0, separatorIndex);
  const tagLine = jugador.slice(separatorIndex + 1);

  const account = await prisma.trackedAccount.findFirst({
    where: { gameName, tagLine },
  });

  if (!account) {
    return `No encontré a **${jugador}** en el ranking. Fijate que esté bien escrito.`;
  }

  const snapshot = await prisma.rankSnapshot.findFirst({
    where: { accountId: account.id, queueType: SOLO_QUEUE_TYPE },
    orderBy: { capturedAt: "desc" },
  });

  if (!snapshot) {
    return `**${account.gameName}#${account.tagLine}** todavía no tiene datos de Solo/Dúo. Que juegue algo primero.`;
  }

  const label = tierLabel(snapshot.tier, snapshot.rank);
  const wr = winrate(snapshot.wins, snapshot.losses);

  return (
    `📊 **${account.gameName}#${account.tagLine}** — Solo/Dúo\n` +
    `**${label}** · ${snapshot.leaguePoints} LP\n` +
    `${snapshot.wins}W ${snapshot.losses}L · ${wr} winrate`
  );
}

async function buildAddPlayerReply(nombre: string, tag: string): Promise<string> {
  try {
    const riotAccount = await getAccountByRiotId(nombre, tag);
    const saved = await prisma.trackedAccount.upsert({
      where: { puuid: riotAccount.puuid },
      update: { gameName: riotAccount.gameName, tagLine: riotAccount.tagLine },
      create: {
        gameName: riotAccount.gameName,
        tagLine: riotAccount.tagLine,
        puuid: riotAccount.puuid,
        platform: "la2",
      },
    });
    return `✅ Agregado **${saved.gameName}#${saved.tagLine}** al ranking. Va a aparecer con datos en el próximo sync.`;
  } catch (err) {
    return `❌ No pude agregar a **${nombre}#${tag}**. Fijate que el Riot ID esté bien escrito. (${err instanceof Error ? err.message : "error desconocido"})`;
  }
}

async function buildBetModal(
  customId: string,
  userId: string | undefined,
  username: string | undefined
): Promise<{ content: string } | { modal: Record<string, unknown> }> {
  const [prefix, choice, roundId] = customId.split(":");
  if (prefix !== "predict" || (choice !== "win" && choice !== "lose") || !roundId) {
    return { content: "Botón no reconocido." };
  }
  if (!userId || !username) {
    return { content: "No pude identificarte." };
  }

  const bettor = await getOrCreateBettor(userId, username);

  return {
    modal: {
      custom_id: `bet_modal:${choice}:${roundId}`,
      title: choice === "win" ? "Apostar a que GANA" : "Apostar a que PIERDE",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "amount",
              style: 1,
              label: `Fichas a apostar (tenés ${bettor.balance})`,
              required: false,
              placeholder: bettor.balance > 0 ? `Máximo ${bettor.balance}, vacío = apuesta mínima` : "Sin fichas — apostá igual, gratis",
            },
          ],
        },
      ],
    },
  };
}

async function refreshRoundStatsMessage(roundId: string): Promise<void> {
  const round = await prisma.predictionRound.findUnique({ where: { id: roundId } });
  if (!round) return;

  const stats = await prisma.prediction.aggregate({
    where: { roundId },
    _count: true,
    _sum: { amount: true },
  });
  const count = stats._count;
  const total = stats._sum.amount ?? 0;
  const statsLine = `\n\n📊 **${count}** ${count === 1 ? "persona apostó" : "personas apostaron"} — **${total}** fichas en juego`;

  await updatePredictionMessageContent(round.messageId, `${round.content}${statsLine}`);
}

async function buildBetSubmitReply(interaction: DiscordInteraction): Promise<string> {
  const customId = interaction.data?.custom_id ?? "";
  const [prefix, choice, roundId] = customId.split(":");
  if (prefix !== "bet_modal" || (choice !== "win" && choice !== "lose") || !roundId) {
    return "Algo salió mal con la apuesta.";
  }

  const userId = interaction.member?.user?.id;
  const username = interaction.member?.user?.username;
  if (!userId || !username) {
    return "No pude identificarte.";
  }

  const amountText = interaction.data?.components?.[0]?.components?.[0]?.value ?? "";
  const result = await placeBet(roundId, userId, username, choice === "win", amountText);

  if (!result.ok) {
    return result.error;
  }

  try {
    await refreshRoundStatsMessage(roundId);
  } catch (err) {
    console.error(`Failed to refresh prediction stats message for round ${roundId}:`, err);
  }

  return result.amount > 0
    ? `Apostaste **${result.amount}** fichas a que **${choice === "win" ? "gana" : "pierde"}**. Saldo restante: ${result.balanceAfter}.`
    : `Apuesta anotada (sin fichas de por medio) a que **${choice === "win" ? "gana" : "pierde"}**. Si acertás igual ganás algo.`;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");

  if (!verifySignature(rawBody, signature, timestamp)) {
    return new NextResponse("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody) as DiscordInteraction;

  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  if (interaction.type === 3) {
    const result = await buildBetModal(
      interaction.data?.custom_id ?? "",
      interaction.member?.user?.id,
      interaction.member?.user?.username
    );
    if ("modal" in result) {
      return NextResponse.json({ type: 9, data: result.modal });
    }
    return NextResponse.json({
      type: 4,
      data: { content: result.content, flags: EPHEMERAL },
    });
  }

  if (interaction.type === 5) {
    const content = await buildBetSubmitReply(interaction);
    return NextResponse.json({
      type: 4,
      data: { content, flags: EPHEMERAL },
    });
  }

  if (interaction.type === 2) {
    if (interaction.data?.name === "rank") {
      const jugador = interaction.data.options?.find((o) => o.name === "jugador")?.value;
      const content = jugador
        ? await buildRankReply(jugador)
        : "Decime a quién querés consultar con la opción `jugador`.";

      return NextResponse.json({
        type: 4,
        data: { content },
      });
    }

    if (interaction.data?.name === "agregar-jugador") {
      const isAdmin = interaction.member?.roles?.includes(ADMIN_ROLE_ID) ?? false;
      if (!isAdmin) {
        return NextResponse.json({
          type: 4,
          data: { content: "🚫 Este comando es solo para Admin Zank.", flags: EPHEMERAL },
        });
      }

      const nombre = interaction.data.options?.find((o) => o.name === "nombre")?.value;
      const tag = interaction.data.options?.find((o) => o.name === "tag")?.value;
      const content =
        nombre && tag
          ? await buildAddPlayerReply(nombre, tag)
          : "Faltan datos: necesito `nombre` y `tag`.";

      return NextResponse.json({
        type: 4,
        data: { content },
      });
    }

    return NextResponse.json({
      type: 4,
      data: { content: "No reconozco ese comando." },
    });
  }

  return new NextResponse("unhandled interaction type", { status: 400 });
}

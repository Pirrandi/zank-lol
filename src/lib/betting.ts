import { prisma } from "./prisma";
import { Prediction } from "@prisma/client";

const STARTING_BALANCE = 100;
const MIN_PAYOUT_NO_STAKE = 20;
const WIN_MULTIPLIER = 2;
const PREDICTION_WINDOW_MS = 5 * 60 * 1000;

export async function getOrCreateBettor(discordUserId: string, discordUsername: string) {
  return prisma.bettor.upsert({
    where: { discordUserId },
    update: { discordUsername },
    create: { discordUserId, discordUsername, balance: STARTING_BALANCE },
  });
}

export type PlaceBetResult =
  | { ok: true; amount: number; balanceAfter: number }
  | { ok: false; error: string };

export async function placeBet(
  roundId: string,
  discordUserId: string,
  discordUsername: string,
  guess: boolean,
  rawAmountText: string
): Promise<PlaceBetResult> {
  const round = await prisma.predictionRound.findUnique({ where: { id: roundId } });
  if (!round || round.status !== "open") {
    return { ok: false, error: "Esta apuesta ya cerró." };
  }
  if (Date.now() - round.createdAt.getTime() > PREDICTION_WINDOW_MS) {
    return { ok: false, error: "Se pasó la ventana de 5 minutos para apostar en esta partida." };
  }

  const parsed = Number(rawAmountText.trim().replace(/[^0-9]/g, ""));
  const requested = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;

  return prisma.$transaction(async (tx) => {
    const bettor = await tx.bettor.upsert({
      where: { discordUserId },
      update: { discordUsername },
      create: { discordUserId, discordUsername, balance: STARTING_BALANCE },
    });

    const existing = await tx.prediction.findUnique({
      where: { roundId_discordUserId: { roundId, discordUserId } },
    });

    const availableBalance = bettor.balance + (existing?.amount ?? 0);
    const amount = Math.min(requested, availableBalance);

    if (existing) {
      await tx.bettor.update({
        where: { discordUserId },
        data: { balance: { increment: existing.amount } },
      });
    }
    await tx.bettor.update({
      where: { discordUserId },
      data: { balance: { decrement: amount } },
    });
    await tx.prediction.upsert({
      where: { roundId_discordUserId: { roundId, discordUserId } },
      update: { guess, amount, discordUsername },
      create: { roundId, discordUserId, discordUsername, guess, amount },
    });

    return { ok: true, amount, balanceAfter: availableBalance - amount };
  });
}

export async function resolvePredictions(
  predictions: Prediction[],
  result: boolean
): Promise<{ correct: (Prediction & { payout: number })[]; wrong: Prediction[] }> {
  const correct: (Prediction & { payout: number })[] = [];
  const wrong: Prediction[] = [];

  for (const p of predictions) {
    if (p.guess === result) {
      const payout = p.amount > 0 ? p.amount * WIN_MULTIPLIER : MIN_PAYOUT_NO_STAKE;
      await prisma.bettor.update({
        where: { discordUserId: p.discordUserId },
        data: { balance: { increment: payout } },
      });
      correct.push({ ...p, payout });
    } else {
      wrong.push(p);
    }
  }

  return { correct, wrong };
}

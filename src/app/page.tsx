import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildQueueStats, type QueueStats } from "@/lib/queue-stats";
import { winStreak, lossStreak, lpDropOverWindow, totalLpGained } from "@/lib/derive";
import { getLpScore } from "@/lib/rank-order";
import { getSyncStatus, getTierSpreadText, POLL_INTERVAL_MINUTES } from "@/lib/sync-status";
import { getLatestVersion } from "@/lib/ddragon";
import { getBiggestPentaKill, getTopQuadraKills, getTopTripleKills, getTopEpicSteals } from "@/lib/highlights";
import { LadderBoard, type PlayerRow } from "./ladder-board";
import { Nav } from "./nav";

const DAY_MS = 24 * 60 * 60 * 1000;

type ShameStreak = { id: string; gameName: string; tagLine: string; streak: number; queueParam: "solo" | "flex"; queueLabel: string };
type ShameLpDrop = { id: string; gameName: string; tagLine: string; drop: number; queueParam: "solo" | "flex"; queueLabel: string };

const SHAME_QUEUES: { type: string; param: "solo" | "flex"; label: string }[] = [
  { type: "RANKED_SOLO_5x5", param: "solo", label: "Solo/Dúo" },
  { type: "RANKED_FLEX_SR", param: "flex", label: "Flexible" },
];

export const dynamic = "force-dynamic";

const QUEUE_IDS: Record<string, number> = {
  RANKED_SOLO_5x5: 420,
  RANKED_FLEX_SR: 440,
};

export default async function HomePage() {
  const accounts = await prisma.trackedAccount.findMany({
    include: {
      snapshots: { orderBy: { capturedAt: "desc" } },
      participations: { include: { match: true } },
    },
  });

  let mostRecentCapturedAt: Date | undefined;
  const allTiers: string[] = [];
  const ddragonVersion = await getLatestVersion();

  const rows: PlayerRow[] = accounts.map((account) => {
    const profileIconUrl =
      account.profileIconId !== null
        ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${account.profileIconId}.png`
        : undefined;
    const soloSnapshots = account.snapshots.filter((s) => s.queueType === "RANKED_SOLO_5x5");
    const flexSnapshots = account.snapshots.filter((s) => s.queueType === "RANKED_FLEX_SR");

    for (const s of account.snapshots) {
      if (!mostRecentCapturedAt || s.capturedAt > mostRecentCapturedAt) {
        mostRecentCapturedAt = s.capturedAt;
      }
    }

    const buildRowQueue = (
      snapshotsDesc: typeof soloSnapshots,
      queueType: string
    ): (QueueStats & { winStreakCount: number; hasMatchData: boolean; sparkline: number[]; recentForm: boolean[] }) | undefined => {
      const stats = buildQueueStats(snapshotsDesc);
      if (!stats) return undefined;
      allTiers.push(stats.tier);

      const queueMatches = account.participations
        .filter((p) => p.match.queueId === QUEUE_IDS[queueType])
        .sort((a, b) => b.match.gameCreation.getTime() - a.match.gameCreation.getTime());

      const sparkline = [...snapshotsDesc].reverse().map((s) => getLpScore(s));
      const recentForm = [...queueMatches.slice(0, 5)].reverse().map((m) => m.win);

      return {
        ...stats,
        winStreakCount: winStreak(queueMatches),
        hasMatchData: queueMatches.length > 0,
        sparkline,
        recentForm,
      };
    };

    return {
      id: account.id,
      gameName: account.gameName,
      tagLine: account.tagLine,
      profileIconUrl,
      inGame: account.inGame,
      solo: buildRowQueue(soloSnapshots, "RANKED_SOLO_5x5"),
      flex: buildRowQueue(flexSnapshots, "RANKED_FLEX_SR"),
    };
  });

  const { syncedAgoText, nextSyncText } = getSyncStatus(mostRecentCapturedAt);
  const tierSpreadText = getTierSpreadText(allTiers);

  const streaks: ShameStreak[] = [];
  const drops: ShameLpDrop[] = [];
  let netLpToday = 0;

  for (const account of accounts) {
    for (const queue of SHAME_QUEUES) {
      const matchesDesc = account.participations
        .filter((p) => p.match.queueId === QUEUE_IDS[queue.type])
        .sort((a, b) => b.match.gameCreation.getTime() - a.match.gameCreation.getTime());
      const streak = lossStreak(matchesDesc);
      if (streak >= 2) {
        streaks.push({
          id: account.id,
          gameName: account.gameName,
          tagLine: account.tagLine,
          streak,
          queueParam: queue.param,
          queueLabel: queue.label,
        });
      }

      const snapshotsAsc = account.snapshots
        .filter((s) => s.queueType === queue.type)
        .slice()
        .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

      const drop = lpDropOverWindow(snapshotsAsc, DAY_MS);
      if (drop && drop.delta < 0) {
        drops.push({
          id: account.id,
          gameName: account.gameName,
          tagLine: account.tagLine,
          drop: -drop.delta,
          queueParam: queue.param,
          queueLabel: queue.label,
        });
      }

      const gained = totalLpGained(snapshotsAsc);
      if (gained !== undefined) netLpToday += gained;
    }
  }

  streaks.sort((a, b) => b.streak - a.streak);
  drops.sort((a, b) => b.drop - a.drop);
  const topStreaks = streaks.slice(0, 3);
  const topDrops = drops.slice(0, 3);

  const [pentaKill, topQuadras, topTriples, topSteals] = await Promise.all([
    getBiggestPentaKill(),
    getTopQuadraKills(),
    getTopTripleKills(),
    getTopEpicSteals(),
  ]);
  const fameHighlights = [pentaKill, topQuadras, topTriples, topSteals].filter(Boolean);

  return (
    <>
      <Nav isHome syncedAgoText={syncedAgoText} nextSyncText={nextSyncText} />

      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 24px" }}>
        <div
          style={{
            padding: "56px 0 32px",
            display: "flex",
            flexWrap: "wrap",
            gap: 40,
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div style={{ maxWidth: 640 }}>
            <h1 style={{ fontSize: 56, lineHeight: 0.98, margin: "0 0 16px", letterSpacing: "-0.02em", color: "var(--color-text)" }}>
              EL RANKING
              <br />
              <span style={{ color: "var(--color-accent)", textShadow: "0 0 32px var(--color-accent-glow)" }}>
                NO MIENTE.
              </span>
            </h1>
            <p style={{ fontSize: 16, color: "var(--color-neutral-700)", maxWidth: 520, margin: 0 }}>
              Rango real. LP real. Cero excusas. Sacado directo de la API de Riot cada{" "}
              {POLL_INTERVAL_MINUTES} minutos, así que a nadie le alcanza para esconder una racha de derrotas.
            </p>
          </div>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            <StatBlock value={String(accounts.length)} label="Invocadores" />
            <StatBlock value={tierSpreadText} label="Rango Completo" />
            <StatBlock value={`${POLL_INTERVAL_MINUTES}m`} label="Intervalo de Sync" />
          </div>
        </div>
        <hr className="hr" />

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 32, alignItems: "start", paddingBottom: 64 }}>
          <div>
            <LadderBoard rows={rows} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24, position: "sticky", top: 24 }}>
            <div className="card" style={{ padding: "20px 22px" }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--color-neutral-600)",
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                LP del grupo (hoy)
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  color: netLpToday === 0 ? "var(--color-text)" : netLpToday > 0 ? "var(--color-win)" : "var(--color-loss)",
                }}
              >
                {netLpToday > 0 ? "+" : ""}
                {netLpToday}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-neutral-600)", marginTop: 4 }}>
                Suma de todo lo ganado y perdido desde que arrancamos a trackear.
              </div>
            </div>

            {fameHighlights.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--color-win)",
                    fontWeight: 800,
                    marginBottom: 12,
                  }}
                >
                  🏆 Muro de la Fama
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pentaKill && (
                    <FameCard
                      emoji="🐉"
                      label="Pentakill"
                      id={pentaKill.id}
                      gameName={pentaKill.gameName}
                      tagLine={pentaKill.tagLine}
                      value="x1"
                      unit={`con ${pentaKill.championName}`}
                      roast="Se cree Faker."
                    />
                  )}
                  {topQuadras && (
                    <FameCard
                      emoji="💥"
                      label="Rey de los cuádruples"
                      id={topQuadras.id}
                      gameName={topQuadras.gameName}
                      tagLine={topQuadras.tagLine}
                      value={`x${topQuadras.value}`}
                      unit={`cuádruples · mejor con ${topQuadras.championName}`}
                      roast="A un kill de ser leyenda."
                    />
                  )}
                  {topTriples && (
                    <FameCard
                      emoji="⚔️"
                      label="Rey de los triples"
                      id={topTriples.id}
                      gameName={topTriples.gameName}
                      tagLine={topTriples.tagLine}
                      value={`x${topTriples.value}`}
                      unit={`triples · mejor con ${topTriples.championName}`}
                      roast="Sabe cuándo hacer daño."
                    />
                  )}
                  {topSteals && (
                    <FameCard
                      emoji="🥷"
                      label="Ladrón de objetivos"
                      id={topSteals.id}
                      gameName={topSteals.gameName}
                      tagLine={topSteals.tagLine}
                      value={`x${topSteals.value}`}
                      unit={`robos épicos · con ${topSteals.championName}`}
                      roast="Le robó el alma al enemigo."
                    />
                  )}
                </div>
              </div>
            )}

            {(topStreaks.length > 0 || topDrops.length > 0) && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--color-loss)",
                    fontWeight: 800,
                    marginBottom: 12,
                  }}
                >
                  💀 Muro de la Vergüenza
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {topStreaks.map((s, i) => (
                    <ShameCard
                      key={`streak-${s.id}-${s.queueParam}`}
                      emoji={i === 0 ? "😭" : "😬"}
                      label="Racha activa"
                      id={s.id}
                      gameName={s.gameName}
                      tagLine={s.tagLine}
                      value={`${s.streak}`}
                      unit={`derrotas · ${s.queueLabel}`}
                      queueParam={s.queueParam}
                      roast="No hay quien lo pare, pero para mal."
                    />
                  ))}
                  {topDrops.map((d, i) => (
                    <ShameCard
                      key={`drop-${d.id}-${d.queueParam}`}
                      emoji={i === 0 ? "📉" : "📊"}
                      label="Caída de LP (24h)"
                      id={d.id}
                      gameName={d.gameName}
                      tagLine={d.tagLine}
                      value={`-${d.drop}`}
                      unit={`LP · ${d.queueLabel}`}
                      queueParam={d.queueParam}
                      roast="En caída libre desde ayer."
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ShameCard({
  emoji,
  label,
  id,
  gameName,
  tagLine,
  value,
  unit,
  queueParam,
  roast,
}: {
  emoji: string;
  label: string;
  id: string;
  gameName: string;
  tagLine: string;
  value: string;
  unit: string;
  queueParam: "solo" | "flex";
  roast: string;
}) {
  return (
    <Link
      href={`/players/${id}?queue=${queueParam}`}
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "16px 18px",
        textDecoration: "none",
        color: "inherit",
        borderColor: "var(--color-loss)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--color-neutral-600)",
          fontWeight: 700,
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>
        {label}
      </div>
      <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.25 }}>
        {gameName}
        <span style={{ color: "var(--color-neutral-500)", fontWeight: 400 }}>#{tagLine}</span>
      </div>
      <div className="mono" style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontWeight: 800, fontSize: 24, color: "var(--color-loss)" }}>{value}</span>
        <span style={{ fontSize: 11, color: "var(--color-neutral-500)", fontWeight: 700 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--color-neutral-700)" }}>{roast}</div>
    </Link>
  );
}

function FameCard({
  emoji,
  label,
  id,
  gameName,
  tagLine,
  value,
  unit,
  roast,
}: {
  emoji: string;
  label: string;
  id: string;
  gameName: string;
  tagLine: string;
  value: string;
  unit: string;
  roast: string;
}) {
  return (
    <Link
      href={`/players/${id}`}
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "16px 18px",
        textDecoration: "none",
        color: "inherit",
        borderColor: "var(--color-win)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--color-neutral-600)",
          fontWeight: 700,
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>
        {label}
      </div>
      <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.25 }}>
        {gameName}
        <span style={{ color: "var(--color-neutral-500)", fontWeight: 400 }}>#{tagLine}</span>
      </div>
      <div className="mono" style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontWeight: 800, fontSize: 24, color: "var(--color-win)" }}>{value}</span>
        <span style={{ fontSize: 11, color: "var(--color-neutral-500)", fontWeight: 700 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--color-neutral-700)" }}>{roast}</div>
    </Link>
  );
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 32, fontWeight: 800, color: "var(--color-text)" }}>{value}</div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-neutral-600)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

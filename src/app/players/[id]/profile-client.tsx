"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TIER_COLORS, UNRANKED_COLOR, WIN_COLOR, LOSS_COLOR, tierLabel, tierEmblemUrl } from "@/lib/tier-colors";
import { winrate, type QueueStats } from "@/lib/queue-stats";
import type { HeadToHeadRecord } from "@/lib/head-to-head";
import { LpChart } from "./lp-chart";

export type FullQueueData = {
  stats: QueueStats | undefined;
  historyPoints: { capturedAt: string; lpScore: number; tier: string; rank: string; leaguePoints: number }[];
  peak: { tier: string; rank: string; leaguePoints: number } | undefined;
  milestones: { capturedAt: string; label: string }[];
  hasMatchData: boolean;
  winStreakCount: number;
  totalLpGained: number | undefined;
};

export type MatchRow = {
  matchId: string;
  championName: string;
  iconUrl: string | undefined;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  queueLabel: string;
  when: string;
  playedAt: string;
  friends: { gameName: string; tagLine: string; sameTeam: boolean }[];
  bets: { count: number; total: number } | undefined;
};

type Queue = "solo" | "flex";
type Range = "7d" | "30d" | "all";

const RANGE_DAYS: Record<Exclude<Range, "all">, number> = { "7d": 7, "30d": 30 };

function formatMilestoneDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", { month: "short", day: "numeric" });
}

export function ProfileClient({
  gameName,
  tagLine,
  profileIconUrl,
  inGame,
  analysisText,
  solo,
  flex,
  initialQueue,
  matches,
  headToHead,
  bannerUrl,
  bannerChampionName,
  leagueOfGraphsUrl,
}: {
  gameName: string;
  tagLine: string;
  profileIconUrl: string | undefined;
  inGame: boolean;
  analysisText: string | undefined;
  solo: FullQueueData;
  flex: FullQueueData;
  initialQueue: Queue;
  matches: MatchRow[];
  headToHead: HeadToHeadRecord[];
  bannerUrl: string | undefined;
  bannerChampionName: string | undefined;
  leagueOfGraphsUrl: string;
}) {
  const [queue, setQueue] = useState<Queue>(initialQueue);
  const [range, setRange] = useState<Range>("30d");

  const selected = queue === "solo" ? solo : flex;

  const chartData = useMemo(() => {
    if (range === "all") return selected.historyPoints;
    const cutoff = Date.now() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
    return selected.historyPoints.filter((p) => new Date(p.capturedAt).getTime() >= cutoff);
  }, [selected, range]);

  const stats = selected.stats;
  const meta = stats ? TIER_COLORS[stats.tier] : undefined;
  const bg = meta?.bg ?? UNRANKED_COLOR.bg;
  const fg = meta?.fg ?? UNRANKED_COLOR.fg;
  const emblem = stats ? tierEmblemUrl(stats.tier) : undefined;
  const label = stats ? tierLabel(stats.tier, stats.rank) : "Sin Rango";
  const wr = stats ? winrate(stats.wins, stats.losses) : "—";
  const record = stats ? `${stats.wins}W ${stats.losses}L` : "—";
  const peakEmblem = selected.peak ? tierEmblemUrl(selected.peak.tier) : undefined;
  const peakLabel = selected.peak ? `${tierLabel(selected.peak.tier, selected.peak.rank)} ${selected.peak.leaguePoints} LP` : "—";

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 72px" }}>
      <div style={{ paddingTop: 28 }}>
        <Link href="/" style={{ color: "var(--color-gold)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          &larr; volver al ranking
        </Link>
      </div>

      <div
        className="card"
        style={{
          position: "relative",
          overflow: "hidden",
          margin: "16px 0 24px",
          padding: "28px 24px 20px",
          minHeight: bannerUrl ? 300 : undefined,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          border: bannerUrl ? "1px solid rgba(11,12,16,0.92)" : undefined,
          backgroundImage: bannerUrl
            ? `linear-gradient(180deg, rgba(11,12,16,0.1) 0%, rgba(11,12,16,0.55) 65%, rgba(11,12,16,0.92) 100%), url(${bannerUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center 20%",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {profileIconUrl && (
              <div style={{ position: "relative", flex: "none" }}>
                <img
                  src={profileIconUrl}
                  alt={gameName}
                  style={{ width: 64, height: 64, borderRadius: "50%", border: "2px solid var(--color-divider)", display: "block" }}
                />
                {inGame && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: -1,
                      right: -1,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "var(--color-win)",
                      border: "2px solid var(--color-bg)",
                      boxShadow: "0 0 6px var(--color-win)",
                      animation: "zkPulse 1.4s ease-in-out infinite",
                    }}
                  />
                )}
              </div>
            )}
            <div>
              <h1 style={{ fontSize: 42, margin: "0 0 4px" }}>
                {gameName}
                <span style={{ color: "var(--color-neutral-500)", fontWeight: 400 }}>#{tagLine}</span>
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {inGame && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "var(--color-win)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    ● En partida ahora
                  </span>
                )}
                <a
                  href={leagueOfGraphsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    fontWeight: 800,
                    color: "var(--color-accent)",
                    border: "1px solid var(--color-accent)",
                    borderRadius: 999,
                    padding: "3px 10px",
                    textDecoration: "none",
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <path d="M15 3h6v6" />
                    <path d="M10 14 21 3" />
                  </svg>
                  League of Graphs
                </a>
              </div>
              {bannerChampionName && (
                <div style={{ fontSize: 11, color: "var(--color-neutral-600)", marginTop: 6 }}>
                  Mayor maestría: <span style={{ color: "var(--color-text)", fontWeight: 700 }}>{bannerChampionName}</span>
                </div>
              )}
            </div>
          </div>
          <div className="seg">
            <label className="seg-opt">
              <input type="radio" name="queue" checked={queue === "solo"} onChange={() => setQueue("solo")} />
              Solo/Dúo
            </label>
            <label className="seg-opt">
              <input type="radio" name="queue" checked={queue === "flex"} onChange={() => setQueue("flex")} />
              Flexible
            </label>
          </div>
        </div>
      </div>

      {analysisText && (
        <div
          className="card"
          style={{
            padding: "16px 20px",
            marginBottom: 24,
            borderColor: "var(--color-accent)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1, flex: "none" }}>🤖</span>
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--color-accent)",
                fontWeight: 800,
                marginBottom: 4,
              }}
            >
              Análisis
            </div>
            <div style={{ fontSize: 14, color: "var(--color-neutral-800)", lineHeight: 1.5 }}>{analysisText}</div>
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          marginBottom: 32,
        }}
      >
        <StatCell label="Rango">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            {emblem && <img src={emblem} alt={label} style={{ height: 48, width: "auto" }} />}
            <span className="tag" style={{ background: bg, color: fg, borderColor: fg }}>
              {label}
            </span>
          </div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 800 }}>{stats ? `${stats.leaguePoints} LP` : "—"}</div>
        </StatCell>
        <StatCell label="% Victorias">
          <div className="mono" style={{ fontSize: 26, fontWeight: 800 }}>{wr}</div>
        </StatCell>
        <StatCell label="Récord">
          <div className="mono" style={{ fontSize: 26, fontWeight: 800 }}>{record}</div>
        </StatCell>
        <StatCell label="Rango Máximo">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {peakEmblem && <img src={peakEmblem} alt={peakLabel} style={{ height: 30, width: "auto" }} />}
            <div className="mono" style={{ fontSize: 16, fontWeight: 800 }}>{peakLabel}</div>
          </div>
        </StatCell>
        <StatCell label="LP Ganado (total)">
          <div
            className="mono"
            style={{
              fontSize: 26,
              fontWeight: 800,
              color:
                selected.totalLpGained === undefined || selected.totalLpGained === 0
                  ? "var(--color-text)"
                  : selected.totalLpGained > 0
                    ? "var(--color-win)"
                    : "var(--color-loss)",
            }}
          >
            {selected.totalLpGained === undefined
              ? "—"
              : `${selected.totalLpGained > 0 ? "+" : ""}${selected.totalLpGained}`}
          </div>
        </StatCell>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <h2 style={{ fontSize: 22, margin: 0 }}>Historial de LP · {queue === "solo" ? "Solo/Dúo" : "Flexible"}</h2>
        <div className="seg">
          <label className="seg-opt">
            <input type="radio" name="range" checked={range === "7d"} onChange={() => setRange("7d")} />
            7D
          </label>
          <label className="seg-opt">
            <input type="radio" name="range" checked={range === "30d"} onChange={() => setRange("30d")} />
            30D
          </label>
          <label className="seg-opt">
            <input type="radio" name="range" checked={range === "all"} onChange={() => setRange("all")} />
            Temporada
          </label>
        </div>
      </div>

      <LpChart data={chartData} />

      {selected.milestones.length > 0 && (
        <div style={{ display: "flex", gap: 0, overflowX: "auto", padding: "20px 0 40px", position: "relative" }}>
          {selected.milestones.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 140, textAlign: "center", position: "relative" }}>
              <div style={{ width: "100%", height: 2, background: "var(--color-divider)", position: "absolute", top: 6, left: 0 }} />
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "var(--color-accent)",
                  boxShadow: "0 0 12px var(--color-accent-glow)",
                  position: "relative",
                  zIndex: 1,
                  marginBottom: 10,
                }}
              />
              <div style={{ fontSize: 12, fontWeight: 800 }}>{m.label}</div>
              <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{formatMilestoneDate(m.capturedAt)}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 32, alignItems: "start" }}>
        <div>
          <h2 style={{ fontSize: 22, margin: "0 0 16px" }}>Partidas Recientes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {matches.length === 0 && (
              <div style={{ color: "var(--color-neutral-600)", fontSize: 13, padding: "12px 0" }}>
                No se encontraron partidas clasificatorias recientes.
              </div>
            )}
            {matches.map((m) => {
              const color = m.win ? WIN_COLOR : LOSS_COLOR;
              return (
                <div
                  key={m.matchId}
                  className="card"
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderLeft: `4px solid ${color}` }}
                >
                  {m.iconUrl ? (
                    <img src={m.iconUrl} alt={m.championName} width={44} height={44} style={{ flex: "none", borderRadius: "50%" }} />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        flex: "none",
                        borderRadius: "50%",
                        background:
                          "repeating-linear-gradient(45deg, var(--color-neutral-200), var(--color-neutral-200) 6px, var(--color-neutral-100) 6px, var(--color-neutral-100) 12px)",
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{m.championName}</div>
                    <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
                      {m.queueLabel} · {m.playedAt} ({m.when})
                    </div>
                    {m.friends.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                        {m.friends.map((f) => {
                          const friendColor = f.sameTeam ? WIN_COLOR : LOSS_COLOR;
                          return (
                            <span
                              key={`${f.gameName}#${f.tagLine}`}
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: 999,
                                color: friendColor,
                                border: `1px solid ${friendColor}`,
                              }}
                            >
                              {f.sameTeam ? "con" : "vs"} {f.gameName}#{f.tagLine}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {m.bets && m.bets.count > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 999,
                            color: "var(--color-accent)",
                            border: "1px solid var(--color-accent)",
                          }}
                        >
                          🎲 {m.bets.count} {m.bets.count === 1 ? "apostó" : "apostaron"} · {m.bets.total} fichas
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--color-neutral-800)", width: 70, textAlign: "right" }}>
                    {m.kills}/{m.deaths}/{m.assists}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color, width: 50, textAlign: "right" }}>{m.win ? "V" : "D"}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <h2 style={{ fontSize: 22, margin: "0 0 16px" }}>Cara a Cara</h2>
          {headToHead.length === 0 && (
            <div style={{ color: "var(--color-neutral-600)", fontSize: 13 }}>Todavía no hay partidas compartidas con amigos rastreados.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {headToHead.map((h) => {
              const total = h.wins + h.losses;
              const pct = total === 0 ? 0 : Math.round((h.wins / total) * 100);
              const leading = h.wins >= h.losses;
              return (
                <div key={h.rivalId} className="card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 13, color: "var(--color-neutral-600)", marginBottom: 8 }}>
                    vs {h.rivalGameName}#{h.rivalTagLine}
                  </div>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>
                    {h.wins}-{h.losses}
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: "var(--color-neutral-100)", position: "relative", overflow: "hidden" }}>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 999,
                        background: leading ? "var(--color-accent)" : "var(--color-loss)",
                        boxShadow: leading ? "0 0 10px var(--color-accent-glow)" : "none",
                        width: `${pct}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)", marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

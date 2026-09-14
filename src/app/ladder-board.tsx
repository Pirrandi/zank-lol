"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { compareRankNullable } from "@/lib/rank-order";
import { TIER_COLORS, UNRANKED_COLOR, WIN_COLOR, LOSS_COLOR, FLAT_COLOR, tierLabel, tierEmblemUrl } from "@/lib/tier-colors";
import { winrate } from "@/lib/queue-stats";
import type { QueueStats } from "@/lib/queue-stats";

type ExtendedQueueStats = QueueStats & {
  winStreakCount: number;
  hasMatchData: boolean;
  sparkline: number[];
  recentForm: boolean[];
};

export type PlayerRow = {
  id: string;
  gameName: string;
  tagLine: string;
  profileIconUrl: string | undefined;
  inGame: boolean;
  solo: ExtendedQueueStats | undefined;
  flex: ExtendedQueueStats | undefined;
};

function LiveDot({ size }: { size: number }) {
  return (
    <div
      title="En partida ahora"
      style={{
        position: "absolute",
        bottom: -1,
        right: -1,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--color-win)",
        border: "2px solid var(--color-bg)",
        boxShadow: "0 0 6px var(--color-win)",
        animation: "zkPulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

type Queue = "solo" | "flex";

const AVATAR_COLORS = ["#E9FF1F", "#3DA9FF", "#FF2D55", "#C8AA6E", "#34d399", "#c084fc"];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function MiniSparkline({ data }: { data: number[] }) {
  const W = 60;
  const H = 24;
  if (data.length < 2) {
    return <svg width={W} height={H} style={{ flex: "none" }} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = W / (data.length - 1);
  const points = data.map((v, i) => `${(i * stepX).toFixed(1)},${(H - ((v - min) / range) * H).toFixed(1)}`);
  const trendColor = data[data.length - 1] >= data[0] ? WIN_COLOR : LOSS_COLOR;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible", flex: "none" }}>
      <polyline points={points.join(" ")} fill="none" stroke={trendColor} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RecentForm({ results }: { results: boolean[] }) {
  if (results.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
      {results.map((win, i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: win ? WIN_COLOR : LOSS_COLOR,
            display: "inline-block",
          }}
        />
      ))}
    </div>
  );
}

const PLACE_META: Record<1 | 2 | 3, { medal: string; color: string }> = {
  1: { medal: "🥇", color: "var(--color-accent)" },
  2: { medal: "🥈", color: "#c7cdd6" },
  3: { medal: "🥉", color: "#c98a4b" },
};

function PodiumCard({
  row,
  queue,
  place,
  sortMode,
}: {
  row: PlayerRow;
  queue: Queue;
  place: 1 | 2 | 3;
  sortMode: SortMode;
}) {
  const q = row[queue];
  if (!q) return null;
  const meta = TIER_COLORS[q.tier] ?? UNRANKED_COLOR;
  const emblem = tierEmblemUrl(q.tier);
  const wr = winrate(q.wins, q.losses);
  const placeMeta = PLACE_META[place];
  const isFirst = place === 1;

  return (
    <Link
      href={`/players/${row.id}?queue=${queue}`}
      className="card podium-card"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 10,
        padding: isFirst ? "28px 18px 22px" : "22px 16px 18px",
        textDecoration: "none",
        color: "inherit",
        borderColor: isFirst ? "var(--color-accent)" : "var(--color-divider)",
        boxShadow: isFirst ? "0 0 44px -14px var(--color-accent-glow)" : "none",
        transform: isFirst ? "translateY(-10px)" : undefined,
      }}
    >
      <div style={{ fontSize: 22, lineHeight: 1 }}>{placeMeta.medal}</div>
      <div style={{ position: "relative", flex: "none" }}>
        {row.profileIconUrl ? (
          <img
            src={row.profileIconUrl}
            alt={row.gameName}
            style={{
              width: isFirst ? 64 : 52,
              height: isFirst ? 64 : 52,
              borderRadius: "50%",
              border: `2px solid ${placeMeta.color}`,
              display: "block",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: isFirst ? 64 : 52,
              height: isFirst ? 64 : 52,
              borderRadius: "50%",
              background: avatarColor(row.gameName),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: isFirst ? 26 : 20,
              fontWeight: 800,
              color: "#0b0c10",
              border: `2px solid ${placeMeta.color}`,
            }}
          >
            {row.gameName.charAt(0).toUpperCase()}
          </div>
        )}
        {row.inGame && <LiveDot size={isFirst ? 16 : 14} />}
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: isFirst ? 18 : 15 }}>{row.gameName}</div>
        <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>#{row.tagLine}</div>
      </div>
      {sortMode === "progress" ? (
        <div
          className="mono"
          style={{
            fontSize: isFirst ? 34 : 26,
            fontWeight: 800,
            lineHeight: 1,
            color:
              q.totalLpGained === undefined || q.totalLpGained === 0
                ? "var(--color-text)"
                : q.totalLpGained > 0
                  ? "var(--color-win)"
                  : "var(--color-loss)",
          }}
        >
          {q.totalLpGained !== undefined ? `${q.totalLpGained > 0 ? "+" : ""}${q.totalLpGained}` : "—"}
          <span style={{ fontSize: 12, color: "var(--color-neutral-500)", fontWeight: 600, marginLeft: 4 }}>
            LP ganado
          </span>
        </div>
      ) : (
        <div className="mono" style={{ fontSize: isFirst ? 34 : 26, fontWeight: 800, color: "var(--color-accent)", lineHeight: 1 }}>
          {q.leaguePoints}
          <span style={{ fontSize: 12, color: "var(--color-neutral-500)", fontWeight: 600, marginLeft: 4 }}>LP</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {emblem && <img src={emblem} alt={q.tier} style={{ height: 44, width: "auto" }} />}
        <span style={{ fontSize: 12, fontWeight: 700, color: meta.fg }}>{tierLabel(q.tier, q.rank)}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
        {q.wins}W {q.losses}L <span style={{ color: "var(--color-neutral-500)" }}>·</span>{" "}
        <span style={{ fontWeight: 800, color: "var(--color-text)" }}>{wr}</span>
      </div>
      <RecentForm results={q.recentForm} />
    </Link>
  );
}

function Podium({ rows, queue, sortMode }: { rows: PlayerRow[]; queue: Queue; sortMode: SortMode }) {
  const ranked = rows.filter((r) => r[queue]);
  if (ranked.length === 0) return null;
  const top3 = ranked.slice(0, 3);

  const slots: { row: PlayerRow; place: 1 | 2 | 3 }[] =
    top3.length === 3
      ? [
          { row: top3[1], place: 2 },
          { row: top3[0], place: 1 },
          { row: top3[2], place: 3 },
        ]
      : top3.map((row, i) => ({ row, place: (i + 1) as 1 | 2 | 3 }));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: top3.length === 3 ? "1fr 1.12fr 1fr" : `repeat(${top3.length}, minmax(0, 1fr))`,
        gap: 16,
        alignItems: "end",
        marginBottom: 32,
      }}
    >
      {slots.map((slot) => (
        <PodiumCard key={slot.row.id} row={slot.row} queue={queue} place={slot.place} sortMode={sortMode} />
      ))}
    </div>
  );
}

type SortMode = "rank" | "progress";

export function LadderBoard({ rows }: { rows: PlayerRow[] }) {
  const [queue, setQueue] = useState<Queue>("solo");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("progress");

  const sortedAll = useMemo(() => {
    if (sortMode === "progress") {
      return [...rows].sort((a, b) => (b[queue]?.totalLpGained ?? -Infinity) - (a[queue]?.totalLpGained ?? -Infinity));
    }
    return [...rows].sort((a, b) => compareRankNullable(a[queue], b[queue]));
  }, [rows, queue, sortMode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedAll;
    return sortedAll.filter((r) => `${r.gameName}${r.tagLine}`.toLowerCase().includes(q));
  }, [sortedAll, query]);

  return (
    <>
      <Podium rows={sortedAll} queue={queue} sortMode={sortMode} />

      <div
        style={{
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <input
          className="input"
          placeholder="Buscar invocador…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 260, maxWidth: "100%", flex: "none" }}
        />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: "none", marginLeft: "auto" }}>
          <div className="seg">
            <label className="seg-opt">
              <input type="radio" name="sortMode" checked={sortMode === "rank"} onChange={() => setSortMode("rank")} />
              Rango
            </label>
            <label className="seg-opt">
              <input type="radio" name="sortMode" checked={sortMode === "progress"} onChange={() => setSortMode("progress")} />
              LP Ganado
            </label>
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

      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 64 }}>
        {filtered.map((row, i) => {
          const q = row[queue];
          const meta = q ? TIER_COLORS[q.tier] : undefined;
          const bg = meta?.bg ?? UNRANKED_COLOR.bg;
          const fg = meta?.fg ?? UNRANKED_COLOR.fg;
          const emblem = q ? tierEmblemUrl(q.tier) : undefined;
          const label = q ? tierLabel(q.tier, q.rank) : "SIN RANGO";
          const wr = q ? winrate(q.wins, q.losses) : "—";
          const deltaColor = !q || q.delta === undefined || q.delta === 0 ? FLAT_COLOR : q.delta > 0 ? WIN_COLOR : LOSS_COLOR;
          const deltaArrow = !q || q.delta === undefined || q.delta === 0 ? "—" : q.delta > 0 ? "▲" : "▼";
          const deltaText = q && q.delta !== undefined ? `${q.delta > 0 ? "+" : ""}${q.delta} LP` : "";
          const rankMoveArrow = !q || q.rankMove === 0 ? "" : q.rankMove > 0 ? "▲" : "▼";
          const rankMoveColor = !q || q.rankMove === 0 ? FLAT_COLOR : q.rankMove > 0 ? WIN_COLOR : LOSS_COLOR;
          const rankMoveText = !q || q.rankMove === 0 ? "" : Math.abs(q.rankMove);
          const hot = !!q?.hotStreak;

          return (
            <Link
              key={row.id}
              href={`/players/${row.id}?queue=${queue}`}
              className="card ladder-row"
              style={{
                animation: "zkFadeUp 0.4s ease both",
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "14px 20px",
                borderLeft: `4px solid ${fg}`,
                cursor: "pointer",
                flexWrap: "wrap",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div className="mono" style={{ fontSize: 20, fontWeight: 800, width: 30, flex: "none", color: "var(--color-neutral-500)" }}>
                {i + 1}
              </div>

              <div style={{ width: 22, flex: "none", textAlign: "center", fontSize: 11, fontWeight: 800, color: rankMoveColor }}>
                {rankMoveArrow}
                {rankMoveText}
              </div>

              <div style={{ position: "relative", flex: "none" }}>
                {row.profileIconUrl ? (
                  <img
                    src={row.profileIconUrl}
                    alt={row.gameName}
                    style={{ width: 40, height: 40, borderRadius: "50%", display: "block", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: avatarColor(row.gameName),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#0b0c10",
                    }}
                  >
                    {row.gameName.charAt(0).toUpperCase()}
                  </div>
                )}
                {row.inGame && <LiveDot size={12} />}
              </div>

              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>
                  {row.gameName}
                  <span style={{ color: "var(--color-neutral-500)", fontWeight: 400 }}>#{row.tagLine}</span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, width: 165, flex: "none" }}>
                {emblem && <img src={emblem} alt={q?.tier ?? "sin rango"} style={{ height: 38, width: "auto", flex: "none" }} />}
                <span className="tag" style={{ background: bg, color: fg, borderColor: fg }}>
                  {label}
                </span>
              </div>

              <div className="mono" style={{ width: 84, flex: "none", textAlign: "right" }}>
                {sortMode === "progress" ? (
                  <>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 15,
                        color:
                          !q || q.totalLpGained === undefined || q.totalLpGained === 0
                            ? "var(--color-text)"
                            : q.totalLpGained > 0
                              ? "var(--color-win)"
                              : "var(--color-loss)",
                      }}
                    >
                      {q && q.totalLpGained !== undefined
                        ? `${q.totalLpGained > 0 ? "+" : ""}${q.totalLpGained}`
                        : "—"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-neutral-500)", fontWeight: 700 }}>LP ganado</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{q ? q.leaguePoints : "—"}</div>
                    <div style={{ fontSize: 11, color: deltaColor, fontWeight: 700 }}>
                      {deltaArrow} {deltaText}
                    </div>
                  </>
                )}
              </div>

              <MiniSparkline data={q?.sparkline ?? []} />

              <div className="mono" style={{ width: 84, flex: "none", textAlign: "right", fontSize: 13, color: "var(--color-neutral-800)" }}>
                {q ? `${q.wins}W ${q.losses}L` : "—"}
              </div>
              <div className="mono" style={{ width: 54, flex: "none", textAlign: "right", fontWeight: 800, fontSize: 14 }}>{wr}</div>

              {hot ? (
                <div style={{ width: 32, flex: "none", textAlign: "center", fontSize: 17, animation: "zkFlame 1.1s ease-in-out infinite" }}>
                  🔥
                  {q!.hasMatchData && (
                    <div className="mono" style={{ fontSize: 10, fontWeight: 800, color: "var(--color-accent)" }}>{q!.winStreakCount}</div>
                  )}
                </div>
              ) : (
                <div style={{ width: 32, flex: "none" }} />
              )}
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--color-neutral-600)", fontSize: 14 }}>
            Ningún invocador coincide con &quot;{query}&quot;.
          </div>
        )}
      </div>
    </>
  );
}

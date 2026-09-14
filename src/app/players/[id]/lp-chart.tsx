import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { tierLabel } from "@/lib/tier-colors";
import { TIERS, RANKS } from "@/lib/rank-order";

type HistoryPoint = {
  capturedAt: string;
  lpScore: number;
  tier: string;
  rank: string;
  leaguePoints: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function formatAxisDate(ms: number): string {
  return new Date(ms).toLocaleDateString("es-CL", { month: "short", day: "numeric" });
}

function formatTooltipDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Best-effort inverse of getLpScore() for axis tick labels — the exact tier/rank for a
// hovered point comes from the real snapshot data via the tooltip, this is only a guide.
function formatScoreTick(score: number): string {
  const tierIdx = Math.max(0, Math.min(TIERS.length - 1, Math.floor(score / 400)));
  const tier = TIERS[tierIdx];
  const remainder = Math.max(0, score - tierIdx * 400);
  const rankIdx = Math.max(0, Math.min(RANKS.length - 1, Math.floor(remainder / 100)));
  return tierLabel(tier, RANKS[rankIdx]);
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: HistoryPoint & { timestamp: number } }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div
      className="card"
      style={{
        padding: "8px 12px",
        borderColor: "var(--color-divider-strong)",
        fontSize: 12,
      }}
    >
      <div style={{ color: "var(--color-neutral-600)", marginBottom: 2 }}>
        {formatTooltipDate(p.capturedAt)}
      </div>
      <div style={{ fontWeight: 800, color: "var(--color-text)" }}>
        {tierLabel(p.tier, p.rank)} · {p.leaguePoints} LP
      </div>
    </div>
  );
}

export function LpChart({ data }: { data: HistoryPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="card" style={{ padding: "20px 12px", margin: "16px 0 8px" }}>
        <div style={{ textAlign: "center", color: "var(--color-neutral-600)", fontSize: 13, padding: "48px 0" }}>
          Aún no hay historial de rango.
        </div>
      </div>
    );
  }

  const chartData = data.map((p) => ({ ...p, timestamp: new Date(p.capturedAt).getTime() }));

  const timestamps = chartData.map((p) => p.timestamp);
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const xDomain: [number, number] = minTs === maxTs ? [minTs - DAY_MS, maxTs + DAY_MS] : [minTs, maxTs];

  const scores = chartData.map((p) => p.lpScore);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const scorePad = Math.max(20, Math.round((maxScore - minScore) * 0.15));
  const yDomain: [number, number] = [minScore - scorePad, maxScore + scorePad];

  return (
    <div className="card" style={{ padding: "20px 12px 8px", margin: "16px 0 8px" }}>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="lpFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-divider)" strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={xDomain}
            scale="time"
            tickFormatter={formatAxisDate}
            tick={{ fontSize: 11, fill: "var(--color-neutral-600)" }}
            axisLine={{ stroke: "var(--color-divider)" }}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            dataKey="lpScore"
            type="number"
            domain={yDomain}
            tickFormatter={formatScoreTick}
            tick={{ fontSize: 11, fill: "var(--color-neutral-600)" }}
            axisLine={false}
            tickLine={false}
            width={82}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "var(--color-accent)", strokeWidth: 1, strokeDasharray: "4 4" }}
          />
          <Area
            type="monotone"
            dataKey="lpScore"
            stroke="var(--color-accent)"
            strokeWidth={3}
            fill="url(#lpFill)"
            dot={chartData.length <= 60 ? { r: 3, fill: "var(--color-accent)", strokeWidth: 0 } : false}
            activeDot={{ r: 6, fill: "var(--color-accent)", stroke: "var(--color-bg)", strokeWidth: 2 }}
            isAnimationActive
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

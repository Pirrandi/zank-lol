"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HistoryPoint = {
  capturedAt: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  lpScore: number;
};

export function LpChart({ data }: { data: HistoryPoint[] }) {
  const points = data.map((point) => ({
    ...point,
    date: new Date(point.capturedAt).toLocaleDateString(),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={points}>
        <CartesianGrid stroke="#21262d" />
        <XAxis dataKey="date" stroke="#8b949e" />
        <YAxis stroke="#8b949e" />
        <Tooltip
          contentStyle={{ background: "#161b22", border: "1px solid #30363d" }}
          labelStyle={{ color: "#e6edf3" }}
          formatter={(_value, _name, item) => {
            const p = item.payload as HistoryPoint;
            return [`${p.tier} ${p.rank} - ${p.leaguePoints} LP`, "Rank"];
          }}
        />
        <Line type="monotone" dataKey="lpScore" stroke="#58a6ff" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

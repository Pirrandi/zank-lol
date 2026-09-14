type HistoryPoint = {
  capturedAt: string;
  lpScore: number;
};

const W = 700;
const H = 180;
const PAD_TOP = 16;
const PAD_BOTTOM = 16;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", { month: "short", day: "numeric" });
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

  const values = data.map((p) => p.lpScore);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const n = values.length;
  const stepX = n > 1 ? W / (n - 1) : 0;
  const points = values.map((v, i) => ({
    x: Math.round(i * stepX),
    y: Math.round(PAD_TOP + (1 - (v - min) / range) * (H - PAD_TOP - PAD_BOTTOM)),
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <div className="card" style={{ padding: "20px 12px 8px", margin: "16px 0 8px" }}>
      <svg width="100%" height={220} viewBox={`0 0 ${W} ${220}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="lpFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <line x1={0} y1={180} x2={W} y2={180} stroke="var(--color-divider)" strokeWidth={1} />
        {n > 1 && (
          <path d={`${path} L${points[points.length - 1].x},180 L${points[0].x},180 Z`} fill="url(#lpFill)" stroke="none" />
        )}
        {n > 1 && (
          <path
            d={path}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={3}
            style={{ strokeDasharray: 900, animation: "zkDraw 1.1s ease forwards" }}
          />
        )}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--color-accent)" />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 4px 0", fontSize: 11, color: "var(--color-neutral-600)" }}>
        <span>{formatDate(data[0].capturedAt)}</span>
        <span>{formatDate(data[data.length - 1].capturedAt)}</span>
      </div>
    </div>
  );
}

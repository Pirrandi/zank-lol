import { ImageResponse } from "next/og";
import { TIER_COLORS, UNRANKED_COLOR } from "@/lib/tier-colors";

let cachedFont: ArrayBuffer | undefined;

async function loadArchivoFont(): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;
  const cssUrl = "https://fonts.googleapis.com/css2?family=Archivo:wght@800&text=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%23%C1%C9%CD%D3%DA%D1%C7%E1%E9%ED%F3%FA%F1%E7.%2F%C2%B7";
  const css = await (
    await fetch(cssUrl, {
      headers: {
        "User-Agent": "Mozilla/4.0 (compatible; MSIE 9.0; Windows NT 5.1; Trident/5.0)",
      },
    })
  ).text();
  const match = css.match(/src: url\(([^)]+)\) format\('(woff|opentype|truetype)'\)/);
  if (!match) throw new Error("Could not resolve Archivo font source");
  const fontRes = await fetch(match[1]);
  cachedFont = await fontRes.arrayBuffer();
  return cachedFont;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameName = searchParams.get("name") ?? "???";
  const tagLine = searchParams.get("tag") ?? "????";
  const tier = (searchParams.get("tier") ?? "IRON").toUpperCase();
  const rank = searchParams.get("rank") ?? "IV";
  const lp = searchParams.get("lp") ?? "0";
  const queue = searchParams.get("queue") ?? "Solo/Dúo";
  const splashUrl = searchParams.get("splash");
  const championName = searchParams.get("champion");

  const meta = TIER_COLORS[tier] ?? UNRANKED_COLOR;
  const noSubRank = tier === "MASTER" || tier === "GRANDMASTER" || tier === "CHALLENGER";
  const rankLabel = noSubRank ? meta.label : `${meta.label} ${rank}`;

  const font = await loadArchivoFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "1000px",
          height: "520px",
          display: "flex",
          position: "relative",
          background: "#0b0c10",
          fontFamily: "Archivo",
        }}
      >
        {splashUrl && (
          <img
            src={splashUrl}
            width={1000}
            height={520}
            style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
          />
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1000px",
            height: "520px",
            background:
              "linear-gradient(0deg, #0b0c10 18%, rgba(11,12,16,0.55) 55%, rgba(11,12,16,0.25) 100%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1000px",
            height: "520px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "48px 56px",
          }}
        >
          <div
            style={{
              display: "flex",
              color: "#E9FF1F",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "4px",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            ¡Subió de rango!
          </div>
          <div style={{ display: "flex", color: "#f5f6f8", fontSize: 64, fontWeight: 800, lineHeight: 1.02 }}>
            {gameName}
            <span style={{ color: "#9aa0ac", marginLeft: 8 }}>#{tagLine}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 22 }}>
            <div
              style={{
                display: "flex",
                fontSize: 34,
                fontWeight: 800,
                color: meta.fg,
                padding: "8px 22px",
                borderRadius: 999,
                border: `3px solid ${meta.fg}`,
                background: "rgba(11,12,16,0.55)",
              }}
            >
              {rankLabel}
            </div>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: "#E9FF1F" }}>
              {lp} LP
            </div>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 800, color: "#9aa0ac" }}>{queue}</div>
          </div>
          {championName && (
            <div style={{ display: "flex", fontSize: 18, color: "#9aa0ac", marginTop: 18 }}>
              con {championName}
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: 1000,
      height: 520,
      fonts: [{ name: "Archivo", data: font, weight: 800, style: "normal" }],
    }
  );
}

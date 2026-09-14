import Link from "next/link";
import { SyncButton } from "./sync-button";

export function Nav({
  isHome,
  isCustoms,
  syncedAgoText,
  nextSyncText,
}: {
  isHome: boolean;
  isCustoms?: boolean;
  syncedAgoText: string;
  nextSyncText: string;
}) {
  return (
    <div className="nav">
      <Link href="/" className="nav-brand">
        ZANK
        <span style={{ color: "var(--color-accent)", textShadow: "0 0 16px var(--color-accent-glow)" }}>.LOL</span>
      </Link>
      <Link href="/" aria-current={isHome ? "page" : undefined}>
        Ranking
      </Link>
      <Link href="/personalizadas" aria-current={isCustoms ? "page" : undefined}>
        Personalizadas
      </Link>
      <div
        className="mono"
        style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, color: "var(--color-neutral-500)", fontSize: 11, letterSpacing: "0.03em" }}
      >
        <span>
          <span style={{ color: "var(--color-win)" }}>●</span> Sincronizado {syncedAgoText} · próxima sync en {nextSyncText}
        </span>
        <SyncButton />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "syncing" | "done";

export function SyncButton() {
  const [status, setStatus] = useState<Status>("idle");
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleClick() {
    if (status === "syncing") return;
    setStatus("syncing");

    const res = await fetch("/api/sync", { method: "POST" }).catch(() => undefined);
    if (!res || (res.status !== 200 && res.status !== 429)) {
      setStatus("idle");
      return;
    }

    pollRef.current = setInterval(async () => {
      const check = await fetch("/api/sync").catch(() => undefined);
      const data = await check?.json().catch(() => undefined);
      if (!data?.syncing) {
        if (pollRef.current) clearInterval(pollRef.current);
        setStatus("done");
        router.refresh();
        setTimeout(() => setStatus("idle"), 3000);
      }
    }, 2000);
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "syncing"}
      className="mono"
      style={{
        background: "none",
        border: "1px solid var(--color-divider)",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 11,
        color: status === "done" ? "var(--color-win)" : "var(--color-neutral-500)",
        cursor: status === "syncing" ? "default" : "pointer",
        opacity: status === "syncing" ? 0.6 : 1,
      }}
    >
      {status === "syncing" ? "Sincronizando…" : status === "done" ? "✓ Listo" : "Sincronizar ahora"}
    </button>
  );
}

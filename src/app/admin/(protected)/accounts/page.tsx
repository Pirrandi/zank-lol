import { prisma } from "@/lib/prisma";
import { tierLabel } from "@/lib/tier-colors";
import { addAccountAction, removeAccountAction } from "./actions";
import { DeleteAccountButton } from "./delete-account-button";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const accounts = await prisma.trackedAccount.findMany({
    include: {
      snapshots: { where: { queueType: "RANKED_SOLO_5x5" }, orderBy: { capturedAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div style={{ maxWidth: 720, margin: "60px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 24px" }}>Cuentas trackeadas</h1>

      <form
        action={addAccountAction}
        className="card"
        style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}
      >
        <h2 style={{ fontSize: 15, margin: 0 }}>Agregar cuenta</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input
            type="text"
            name="gameName"
            placeholder="Nombre (sin numeral)"
            required
            className="input"
            style={{ flex: "2 1 160px" }}
          />
          <input type="text" name="tagLine" placeholder="Tag" required className="input" style={{ flex: "1 1 100px" }} />
          <input
            type="text"
            name="platform"
            placeholder="Plataforma"
            defaultValue="la2"
            className="input mono"
            style={{ flex: "1 1 100px" }}
          />
        </div>
        {error && (
          <p style={{ color: "var(--color-loss)", fontSize: 13, margin: 0 }}>{error}</p>
        )}
        <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
          Agregar
        </button>
      </form>

      <div className="card" style={{ overflow: "hidden" }}>
        {accounts.length === 0 && (
          <p style={{ padding: 24, color: "var(--color-neutral-500)", margin: 0 }}>Todavía no hay cuentas trackeadas.</p>
        )}
        {accounts.map((account, i) => {
          const snapshot = account.snapshots[0];
          return (
            <div
              key={account.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 20px",
                borderTop: i === 0 ? undefined : "1px solid var(--color-divider)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>
                  {account.gameName}
                  <span style={{ color: "var(--color-neutral-500)" }}>#{account.tagLine}</span>
                </div>
                <div className="mono" style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
                  {account.platform} · {snapshot ? `${tierLabel(snapshot.tier, snapshot.rank)} · ${snapshot.leaguePoints} LP` : "Sin rango"}
                </div>
              </div>
              <form action={removeAccountAction}>
                <input type="hidden" name="accountId" value={account.id} />
                <DeleteAccountButton accountLabel={`${account.gameName}#${account.tagLine}`} />
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}

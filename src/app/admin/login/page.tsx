import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div style={{ maxWidth: 360, margin: "96px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 24 }}>
        ZANK<span style={{ color: "var(--color-accent)" }}>.LOL</span> admin
      </h1>
      <form
        action={loginAction}
        className="card"
        style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--color-neutral-600)" }}>
          Contraseña
          <input type="password" name="password" required autoFocus className="input" />
        </label>
        {error && (
          <p style={{ color: "var(--color-loss)", fontSize: 13, margin: 0 }}>Contraseña incorrecta.</p>
        )}
        <button type="submit" className="btn btn-primary">
          Entrar
        </button>
      </form>
    </div>
  );
}

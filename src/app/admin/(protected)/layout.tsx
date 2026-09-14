import Link from "next/link";
import { logoutAction } from "../actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="nav">
        <Link href="/admin" className="nav-brand">
          ZANK<span style={{ color: "var(--color-accent)" }}>.LOL</span> admin
        </Link>
        <Link href="/admin/settings">Configuración</Link>
        <Link href="/admin/accounts">Cuentas</Link>
        <form action={logoutAction} style={{ marginLeft: "auto" }}>
          <button
            type="submit"
            className="mono"
            style={{
              background: "none",
              border: "1px solid var(--color-divider)",
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 11,
              color: "var(--color-neutral-500)",
              cursor: "pointer",
            }}
          >
            Cerrar sesión
          </button>
        </form>
      </div>
      {children}
    </>
  );
}

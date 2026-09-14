import Link from "next/link";
import { logoutAction } from "./actions";

export default function AdminHomePage() {
  return (
    <div style={{ maxWidth: 480, margin: "60px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Panel de administración</h1>
      <p style={{ color: "var(--color-neutral-500)", marginBottom: 24 }}>
        Gestioná la configuración y las cuentas trackeadas de zank.lol.
      </p>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <Link href="/admin/settings" className="btn">
          Configuración
        </Link>
        <Link href="/admin/accounts" className="btn">
          Cuentas
        </Link>
      </div>
      <form action={logoutAction}>
        <button type="submit" className="btn btn-danger">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}

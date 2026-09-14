"use client";

export function DeleteAccountButton({ accountLabel }: { accountLabel: string }) {
  return (
    <button
      type="submit"
      className="btn btn-danger"
      onClick={(e) => {
        if (!confirm(`¿Eliminar a ${accountLabel}? Se borra también su historial de rango y partidas.`)) {
          e.preventDefault();
        }
      }}
    >
      Eliminar
    </button>
  );
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addTrackedAccount, deleteTrackedAccountCascade } from "@/lib/accounts";

export async function addAccountAction(formData: FormData): Promise<void> {
  const gameName = String(formData.get("gameName") ?? "").trim();
  const tagLine = String(formData.get("tagLine") ?? "").trim();
  const platform = String(formData.get("platform") ?? "").trim() || "la2";

  if (!gameName || !tagLine) {
    redirect(`/admin/accounts?error=${encodeURIComponent("Falta el nombre o el tag.")}`);
  }

  try {
    await addTrackedAccount(gameName, tagLine, platform);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido buscando la cuenta.";
    redirect(`/admin/accounts?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/accounts");
}

export async function removeAccountAction(formData: FormData): Promise<void> {
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) return;

  await deleteTrackedAccountCascade(accountId);
  revalidatePath("/admin/accounts");
}

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminPassword } from "@/lib/admin-password";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/session";

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const valid = password.length > 0 && (await verifyAdminPassword(password));

  if (!valid) {
    redirect("/admin/login?error=1");
  }

  const token = await createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  });

  redirect("/admin");
}

"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { setSessionUser, clearSession } from "@/lib/session";

export async function loginAsUser(formData: FormData) {
  const userId = String(formData.get("userId") || "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    redirect("/login?error=1");
  }
  await setSessionUser(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

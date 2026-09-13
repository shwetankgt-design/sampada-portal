"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";

export async function uploadDocument(formData: FormData) {
  const applicationId = String(formData.get("applicationId") || "");
  const docType = String(formData.get("docType") || "Other");
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return;
  }

  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const blob = await put(`uploads/${applicationId}/${safeName}`, file, {
    access: "public",
  });

  await prisma.applicationDocument.create({
    data: {
      applicationId,
      docType,
      fileName: file.name,
      filePath: blob.url,
    },
  });

  revalidatePath(`/applications/${applicationId}`);
}

export async function toggleDocumentVerified(formData: FormData) {
  const id = String(formData.get("id") || "");
  const applicationId = String(formData.get("applicationId") || "");
  const verified = String(formData.get("verified") || "") === "true";
  await prisma.applicationDocument.update({ where: { id }, data: { verified: !verified } });
  revalidatePath(`/applications/${applicationId}`);
}

"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) || "").trim();
}
function dateOrNull(formData: FormData, key: string): Date | null {
  const v = str(formData, key);
  return v ? new Date(v) : null;
}

export async function generateDisbursementSchedule(formData: FormData) {
  const applicationId = str(formData, "applicationId");
  const application = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });

  const existing = await prisma.disbursement.count({ where: { applicationId } });
  if (existing > 0 || !application.approvedGrantAmount || !application.approvalLetterDate) {
    revalidatePath(`/applications/${applicationId}`);
    return;
  }

  const grant = application.approvedGrantAmount;
  const base = application.approvalLetterDate;
  const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 24 * 60 * 60 * 1000);

  const schedule = [
    { installment: "FIRST", pct: 0.4, afterDays: 75 },
    { installment: "SECOND", pct: 0.35, afterDays: 180 },
    { installment: "FINAL", pct: 0.25, afterDays: 300 },
  ];

  await prisma.disbursement.createMany({
    data: schedule.map((s) => ({
      applicationId,
      installment: s.installment,
      plannedDate: addDays(base, s.afterDays),
      amount: Math.round(grant * s.pct),
      status: "PLANNED",
    })),
  });

  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/dashboard/grants");
}

export async function updateDisbursement(formData: FormData) {
  const id = str(formData, "id");
  const applicationId = str(formData, "applicationId");
  const status = str(formData, "status");
  const actualDate = dateOrNull(formData, "actualDate");
  const delayReason = str(formData, "delayReason");
  const revisedExpectedDate = dateOrNull(formData, "revisedExpectedDate");

  await prisma.disbursement.update({
    where: { id },
    data: {
      status,
      actualDate: status === "RELEASED" ? actualDate : null,
      delayReason: status === "DELAYED" ? delayReason || null : null,
      revisedExpectedDate: status === "DELAYED" ? revisedExpectedDate : null,
    },
  });

  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/dashboard/grants");
}

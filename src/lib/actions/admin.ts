"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function num(formData: FormData, key: string): number {
  return Number(formData.get(key) || 0);
}
function str(formData: FormData, key: string): string {
  return String(formData.get(key) || "");
}

export async function updateSchemeParams(formData: FormData) {
  const id = str(formData, "id");
  await prisma.scheme.update({
    where: { id },
    data: {
      subsidyGeneralPct: num(formData, "subsidyGeneralPct"),
      subsidyDifficultPct: num(formData, "subsidyDifficultPct"),
      subsidyCapAmount: num(formData, "subsidyCapAmount"),
      subsidyCapLabel: str(formData, "subsidyCapLabel"),
      minEquityGeneralPct: num(formData, "minEquityGeneralPct"),
      minEquityDifficultPct: num(formData, "minEquityDifficultPct"),
      minTermLoanGeneralPct: num(formData, "minTermLoanGeneralPct"),
      minTermLoanDifficultPct: num(formData, "minTermLoanDifficultPct"),
      netWorthMultiplierGeneral: num(formData, "netWorthMultiplierGeneral"),
      netWorthMultiplierDifficult: num(formData, "netWorthMultiplierDifficult"),
      processingFeeGeneral: num(formData, "processingFeeGeneral"),
      processingFeeScSt: num(formData, "processingFeeScSt"),
      performanceSecurityPct: num(formData, "performanceSecurityPct"),
      passThresholdGeneralPct: num(formData, "passThresholdGeneralPct"),
      passThresholdScStPct: num(formData, "passThresholdScStPct"),
      coolOffYears: Math.round(num(formData, "coolOffYears")),
      maxProjectsPerDecade: Math.round(num(formData, "maxProjectsPerDecade")),
      budgetAllocationAmount: num(formData, "budgetAllocationAmount"),
      eoiReleaseDate: formData.get("eoiReleaseDate") ? new Date(str(formData, "eoiReleaseDate")) : null,
      eoiClosingDate: formData.get("eoiClosingDate") ? new Date(str(formData, "eoiClosingDate")) : null,
      outerSubmissionDays: Math.round(num(formData, "outerSubmissionDays")),
    },
  });
  revalidatePath(`/admin/schemes/${id}`);
  revalidatePath(`/schemes/${id}`);
  revalidatePath(`/dashboard/grants`);
}

export async function updateCriterionMarks(formData: FormData) {
  const id = str(formData, "id");
  const schemeId = str(formData, "schemeId");
  const maxMarks = num(formData, "maxMarks");
  await prisma.scoringCriterion.update({ where: { id }, data: { maxMarks } });
  revalidatePath(`/admin/schemes/${schemeId}`);
  revalidatePath(`/schemes/${schemeId}`);
}

export async function toggleCriterionActive(formData: FormData) {
  const id = str(formData, "id");
  const schemeId = str(formData, "schemeId");
  const isActive = str(formData, "isActive") === "true";
  await prisma.scoringCriterion.update({ where: { id }, data: { isActive: !isActive } });
  revalidatePath(`/admin/schemes/${schemeId}`);
  revalidatePath(`/schemes/${schemeId}`);
}

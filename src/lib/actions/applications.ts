"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assessApplication } from "@/lib/ruleEngine";
import { revalidatePath } from "next/cache";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) || "").trim();
}
function numOrNull(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function createApplication(formData: FormData) {
  const schemeId = str(formData, "schemeId");
  const scheme = await prisma.scheme.findUniqueOrThrow({ where: { id: schemeId } });

  const applicantName = str(formData, "applicantName");
  const entityType = str(formData, "entityType");
  const category = str(formData, "category") || "GENERAL";
  const isDifficultArea = formData.get("isDifficultArea") === "on";
  const state = str(formData, "state");
  const district = str(formData, "district");
  const totalProjectCost = numOrNull(formData, "totalProjectCost");
  const eligibleProjectCost = numOrNull(formData, "eligibleProjectCost");
  const subsidySought = numOrNull(formData, "subsidySought");

  const count = await prisma.application.count({ where: { schemeId } });
  const applicationNo = `${scheme.code}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

  const application = await prisma.application.create({
    data: {
      applicationNo,
      schemeId,
      applicantName,
      entityType,
      category,
      isDifficultArea,
      state,
      district,
      totalProjectCost: totalProjectCost ?? undefined,
      eligibleProjectCost: eligibleProjectCost ?? undefined,
      subsidySought: subsidySought ?? undefined,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  // Persist all structured data-entry fields (equityPct, termLoanPct, netWorth, irrPct,
  // avgDscr, boolean criterion flags crit_*, and eligibility flags) as key/value rows.
  const dataKeys = [
    "equityPct",
    "termLoanPct",
    "netWorth",
    "irrPct",
    "avgDscr",
    "hasDetailedAppraisalNote",
    "hasStatutoryDocs",
    "isInsolvent",
    "coolOffSatisfied",
    "maxProjectsSatisfied",
    "isScSt",
    "scstNetWorthSharePct",
  ];
  const entries: { fieldKey: string; fieldValue: string }[] = [];

  entries.push({ fieldKey: "subsidySought", fieldValue: String(subsidySought ?? "") });
  if (eligibleProjectCost !== null) {
    entries.push({ fieldKey: "eligibleProjectCostCr", fieldValue: String(eligibleProjectCost / 1_00_00_000) });
  }

  for (const key of dataKeys) {
    if (!formData.has(key)) continue;
    const raw = formData.get(key);
    const isCheckbox = ["hasDetailedAppraisalNote", "hasStatutoryDocs", "isInsolvent", "isScSt"].includes(key);
    const isFlagSelect = ["coolOffSatisfied", "maxProjectsSatisfied"].includes(key);
    let value: string;
    if (isCheckbox) value = raw === "on" ? "true" : "false";
    else if (isFlagSelect) value = String(raw);
    else value = String(raw ?? "");
    entries.push({ fieldKey: key, fieldValue: value });
  }

  // Boolean scoring-criterion checkboxes: crit_<code>
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("crit_")) {
      entries.push({ fieldKey: key, fieldValue: value === "on" ? "true" : "false" });
    }
  }

  await prisma.applicationDataValue.createMany({
    data: entries
      .filter((e) => e.fieldValue !== "")
      .map((e) => ({ applicationId: application.id, ...e })),
  });

  await assessApplication(application.id);

  revalidatePath("/dashboard");
  revalidatePath("/applications");
  redirect(`/applications/${application.id}`);
}

export async function recordPresentationScore(formData: FormData) {
  const applicationId = str(formData, "applicationId");
  const criterionId = str(formData, "criterionId");
  const marksAwarded = Number(formData.get("marksAwarded") || 0);
  const remarks = str(formData, "remarks");

  await prisma.applicationScore.upsert({
    where: { applicationId_criterionId: { applicationId, criterionId } },
    update: { marksAwarded, remarks: remarks || null },
    create: { applicationId, criterionId, marksAwarded, remarks: remarks || null },
  });

  await assessApplication(applicationId);
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/dashboard");
}

export async function reassessApplication(formData: FormData) {
  const applicationId = str(formData, "applicationId");
  await assessApplication(applicationId);
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/dashboard");
}

export async function finalizeApprovalDecision(formData: FormData) {
  const applicationId = str(formData, "applicationId");
  const decision = str(formData, "decision"); // APPROVED | REJECTED

  if (decision === "APPROVED") {
    const application = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: decision,
        approvalLetterDate: new Date(),
        approvedGrantAmount: application.subsidySought ?? undefined,
      },
    });
  } else {
    await prisma.application.update({ where: { id: applicationId }, data: { status: decision } });
  }

  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/grants");
}

import { prisma } from "@/lib/prisma";
import type { Scheme, ScoringCriterion, ApplicationDataValue } from "@prisma/client";

export type DataMap = Record<string, string>;

export function toDataMap(values: ApplicationDataValue[]): DataMap {
  const map: DataMap = {};
  for (const v of values) map[v.fieldKey] = v.fieldValue;
  return map;
}

function num(map: DataMap, key: string): number | null {
  const raw = map[key];
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function bool(map: DataMap, key: string): boolean {
  return map[key] === "true";
}

// ---------------- Eligibility gate ----------------

export type EligibilityResult = {
  checkKey: string;
  label: string;
  passed: boolean;
  remarks?: string;
};

export function runEligibilityChecks(
  scheme: Scheme,
  isDifficultOrPriority: boolean,
  data: DataMap
): { checks: EligibilityResult[]; passed: boolean } {
  const checks: EligibilityResult[] = [];

  const minEquity = isDifficultOrPriority ? scheme.minEquityDifficultPct : scheme.minEquityGeneralPct;
  const equityPct = num(data, "equityPct");
  const equityOk = equityPct !== null && equityPct >= minEquity;
  checks.push({
    checkKey: "equity",
    label: `Promoter's equity >= ${minEquity}% of total project cost`,
    passed: equityOk,
    remarks:
      equityPct === null
        ? `Equity percentage not provided — cannot confirm the required minimum of ${minEquity}% (${isDifficultOrPriority ? "difficult area / SC-ST / FPO" : "general area"} threshold).`
        : equityOk
          ? `Declared equity of ${equityPct}% meets the required minimum of ${minEquity}% for ${isDifficultOrPriority ? "difficult areas / SC-ST / FPO" : "general areas"}.`
          : `Declared equity of ${equityPct}% is below the required minimum of ${minEquity}% for ${isDifficultOrPriority ? "difficult areas / SC-ST / FPO" : "general areas"}.`,
  });

  const minLoan = isDifficultOrPriority ? scheme.minTermLoanDifficultPct : scheme.minTermLoanGeneralPct;
  const loanPct = num(data, "termLoanPct");
  const loanOk = loanPct !== null && loanPct >= minLoan;
  checks.push({
    checkKey: "termLoan",
    label: `Term loan from RBI-approved Bank/FI/NBFC >= ${minLoan}% of total project cost`,
    passed: loanOk,
    remarks:
      loanPct === null
        ? `Term loan percentage not provided — cannot confirm the required minimum of ${minLoan}%.`
        : loanOk
          ? `Sanctioned term loan of ${loanPct}% of total project cost meets the required minimum of ${minLoan}%.`
          : `Sanctioned term loan of ${loanPct}% of total project cost is below the required minimum of ${minLoan}%.`,
  });

  const netWorthMultiplier = isDifficultOrPriority
    ? scheme.netWorthMultiplierDifficult
    : scheme.netWorthMultiplierGeneral;
  const netWorth = num(data, "netWorth");
  const subsidySought = num(data, "subsidySought");
  const netWorthOk =
    netWorth !== null && subsidySought !== null && netWorth >= subsidySought * netWorthMultiplier;
  checks.push({
    checkKey: "netWorth",
    label: `Combined net worth >= ${netWorthMultiplier}x subsidy sought`,
    passed: netWorthOk,
    remarks:
      netWorth === null || subsidySought === null
        ? "Net worth or subsidy sought not provided — cannot confirm this requirement."
        : netWorthOk
          ? `Declared net worth of ₹${netWorth.toLocaleString("en-IN")} meets the required ₹${Math.round(subsidySought * netWorthMultiplier).toLocaleString("en-IN")} (${netWorthMultiplier}× the ₹${subsidySought.toLocaleString("en-IN")} subsidy sought).`
          : `Declared net worth of ₹${netWorth.toLocaleString("en-IN")} is below the required ₹${Math.round(subsidySought * netWorthMultiplier).toLocaleString("en-IN")} (${netWorthMultiplier}× the ₹${subsidySought.toLocaleString("en-IN")} subsidy sought).`,
  });

  const hasAppraisalNote = bool(data, "hasDetailedAppraisalNote");
  checks.push({
    checkKey: "appraisalNote",
    label: "Detailed Appraisal Note from Scheduled Commercial Bank/NABARD/SIDBI/NEDFi submitted",
    passed: hasAppraisalNote,
    remarks: hasAppraisalNote
      ? "Declared as submitted by the scrutiny officer. Cross-check against the 'Bank Appraisal Note' document uploaded for this application before final approval."
      : "Not declared as submitted. A Detailed Appraisal Note from a Scheduled Commercial Bank/NABARD/SIDBI/NEDFi is mandatory — a Techno-Economic Viability Report merely stamped/endorsed does not qualify.",
  });

  const hasStatutoryDocs = bool(data, "hasStatutoryDocs");
  checks.push({
    checkKey: "statutoryDocs",
    label: "Certificate of incorporation/registration, PAN, GSTIN/MSME Udyam, and by-laws permitting commercial activity submitted",
    passed: hasStatutoryDocs,
    remarks: hasStatutoryDocs
      ? "Declared as submitted. Cross-check against the 'Certificate of Incorporation / MoA / By-laws' and 'PAN / GSTIN / MSME Udyam' documents uploaded for this application."
      : "Not declared as submitted. Incorporation/registration certificate, PAN, GSTIN/MSME Udyam and by-laws explicitly permitting the proposed commercial activity are all mandatory.",
  });

  const isInsolvent = bool(data, "isInsolvent");
  checks.push({
    checkKey: "insolvency",
    label: "Entity is not insolvent, in receivership, bankrupt, or under legal proceedings for the same",
    passed: !isInsolvent,
    remarks: isInsolvent
      ? "Flagged as insolvent/in receivership/under legal proceedings — this automatically disqualifies the proposal regardless of score."
      : "No insolvency, receivership, bankruptcy or related adverse legal proceedings declared against the entity.",
  });

  const coolOffFlag = data["coolOffSatisfied"];
  const coolOffOk = coolOffFlag === undefined ? true : coolOffFlag === "true";
  checks.push({
    checkKey: "coolOff",
    label: `Cool-off period since last MoFPI assistance satisfied (>= ${scheme.coolOffYears} years, or first-time applicant)`,
    passed: coolOffOk,
    remarks:
      coolOffFlag === undefined
        ? "Not specified at intake — defaulted to pass as a first-time applicant. Verify against MoFPI's past-assistance records before final approval."
        : coolOffOk
          ? `Confirmed by the scrutiny officer that the mandatory ${scheme.coolOffYears}-year cool-off period since the entity's last MoFPI assistance has elapsed.`
          : `The entity/promoter(s) have not yet completed the mandatory ${scheme.coolOffYears}-year cool-off period since their last MoFPI assistance (counted from the earlier of final instalment or CTO date, up to this EoI's closing date).`,
  });

  const maxProjectsFlag = data["maxProjectsSatisfied"];
  const maxProjectsOk = maxProjectsFlag === undefined ? true : maxProjectsFlag === "true";
  checks.push({
    checkKey: "maxProjects",
    label: `Entity/promoter(s) have not exceeded ${scheme.maxProjectsPerDecade} projects under any PMKSY sub-scheme in 10 years`,
    passed: maxProjectsOk,
    remarks:
      maxProjectsFlag === undefined
        ? "Not specified at intake — defaulted to pass. Verify against MoFPI's past-assistance records before final approval."
        : maxProjectsOk
          ? `Confirmed by the scrutiny officer that the entity/promoter(s) remain within the ${scheme.maxProjectsPerDecade}-project limit over a 10-year window across all PMKSY sub-schemes.`
          : `The entity/promoter(s) have already been assisted for ${scheme.maxProjectsPerDecade} or more projects under PMKSY sub-schemes within the preceding 10 years.`,
  });

  if (bool(data, "isScSt")) {
    const scstShare = num(data, "scstNetWorthSharePct");
    const scstShareOk = scstShare === null || scstShare >= 10;
    checks.push({
      checkKey: "scstShare",
      label: "SC/ST member(s) hold at least 51% stake (and >=10% of combined net worth)",
      passed: scstShareOk,
      remarks:
        scstShare === null
          ? "SC/ST category declared but the SC/ST share of combined net worth was not provided — verify before approval."
          : scstShareOk
            ? `Declared SC/ST share of combined net worth (${scstShare}%) meets the required minimum of 10%.`
            : `Declared SC/ST share of combined net worth (${scstShare}%) is below the required minimum of 10%.`,
    });
  }

  const passed = checks.every((c) => c.passed);
  return { checks, passed };
}

// ---------------- Scoring ----------------

export type ScoreLine = {
  criterion: ScoringCriterion;
  isLeaf: boolean;
  awarded: number;
  source: "MANUAL_OVERRIDE" | "AUTO" | "UNSCORED";
};

type BandConfig = { field: string; bands: { min: number; marks: number }[] };

export type AutoMarkResult = { marks: number; reason: string };

export function computeAutoMarks(criterion: ScoringCriterion, data: DataMap): AutoMarkResult {
  if (criterion.inputType === "BOOLEAN") {
    const key = boundKeyForCriterion(criterion.code);
    const declared = bool(data, key);
    if (declared) {
      return {
        marks: criterion.maxMarks,
        reason: `Declared as satisfied for "${criterion.label}" — full ${criterion.maxMarks} marks awarded. Verify against the linked supporting document(s) before finalising.`,
      };
    }
    return {
      marks: 0,
      reason: `Not declared as satisfied for "${criterion.label}" — 0 of ${criterion.maxMarks} marks awarded. Re-score if supporting evidence is later confirmed.`,
    };
  }
  if (criterion.inputType === "BAND" && criterion.bandConfig) {
    const cfg = JSON.parse(criterion.bandConfig) as BandConfig;
    const value = num(data, cfg.field);
    if (value === null) {
      return {
        marks: 0,
        reason: `No value provided for "${cfg.field}" — 0 of ${criterion.maxMarks} marks awarded pending data entry.`,
      };
    }
    const sorted = [...cfg.bands].sort((a, b) => b.min - a.min);
    for (const band of sorted) {
      if (value >= band.min) {
        const marks = Math.min(band.marks, criterion.maxMarks);
        return {
          marks,
          reason: `Value ${value} meets the >= ${band.min} band threshold — ${marks} of ${criterion.maxMarks} marks awarded.`,
        };
      }
    }
    const lowestBand = sorted[sorted.length - 1];
    return {
      marks: 0,
      reason: `Value ${value} falls below the lowest scoring band (>= ${lowestBand?.min ?? 0}) — 0 of ${criterion.maxMarks} marks awarded.`,
    };
  }
  return {
    marks: 0,
    reason: "No automatic scoring rule configured for this criterion — requires manual entry by the approver.",
  };
}

// maps a leaf criterion code to the boolean field key stored in ApplicationDataValue
function boundKeyForCriterion(code: string): string {
  return `crit_${code.replace(/\./g, "_")}`;
}

export async function assessApplication(applicationId: string) {
  const application = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { scheme: true, dataValues: true },
  });
  const scheme = application.scheme;
  const data = toDataMap(application.dataValues);
  const isDifficultOrPriority =
    application.isDifficultArea ||
    application.category === "SC_ST" ||
    application.category === "FPO";

  // ---- Eligibility ----
  const { checks, passed: eligibilityPassed } = runEligibilityChecks(
    scheme,
    isDifficultOrPriority,
    data
  );

  await prisma.eligibilityCheck.deleteMany({ where: { applicationId } });
  await prisma.eligibilityCheck.createMany({
    data: checks.map((c) => ({
      applicationId,
      checkKey: c.checkKey,
      label: c.label,
      passed: c.passed,
      remarks: c.remarks,
    })),
  });

  // ---- Scoring ----
  // Criteria form a two-level tree: top-level items (parentCode === null, e.g. "1".."10")
  // and their sub-items (e.g. "1.1", "1.2"). A top-level item's children are either
  // ADDITIVE (their max marks sum to the parent's max marks, e.g. IRR + DSCR) or
  // ALTERNATIVE / pick-best-tier (their max marks exceed the parent's, e.g. the three
  // land-title tiers, of which only the best applicable tier counts). Either way the
  // group contributes at most its own top-level maxMarks toward the total.
  const criteria = await prisma.scoringCriterion.findMany({
    where: { schemeId: scheme.id, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  const childrenByParent = new Map<string, ScoringCriterion[]>();
  for (const c of criteria) {
    if (!c.parentCode) continue;
    const list = childrenByParent.get(c.parentCode) ?? [];
    list.push(c);
    childrenByParent.set(c.parentCode, list);
  }
  const existingScores = await prisma.applicationScore.findMany({ where: { applicationId } });
  const existingByCriterion = new Map(existingScores.map((s) => [s.criterionId, s]));

  async function resolveAwarded(criterion: ScoringCriterion): Promise<{ awarded: number; pending: boolean }> {
    const existing = existingByCriterion.get(criterion.id);
    if (existing) return { awarded: existing.marksAwarded, pending: false };
    if (criterion.stage === "PRESENTATION") return { awarded: 0, pending: true };
    const { marks, reason } = computeAutoMarks(criterion, data);
    await prisma.applicationScore.create({
      data: { applicationId, criterionId: criterion.id, marksAwarded: marks, remarks: reason },
    });
    return { awarded: marks, pending: false };
  }

  let totalScore = 0;
  let maxScore = 0;
  let presentationPending = false;

  const topLevel = criteria.filter((c) => !c.parentCode);
  for (const criterion of topLevel) {
    maxScore += criterion.maxMarks;
    const children = childrenByParent.get(criterion.code);

    if (!children || children.length === 0) {
      const { awarded, pending } = await resolveAwarded(criterion);
      if (pending) presentationPending = true;
      totalScore += Math.min(awarded, criterion.maxMarks);
      continue;
    }

    const childSumMax = children.reduce((s, c) => s + c.maxMarks, 0);
    const isAlternative = childSumMax > criterion.maxMarks;

    const childAwardedValues: number[] = [];
    for (const child of children) {
      const { awarded, pending } = await resolveAwarded(child);
      if (pending) presentationPending = true;
      childAwardedValues.push(awarded);
    }

    const groupAwarded = isAlternative
      ? Math.max(0, ...childAwardedValues)
      : childAwardedValues.reduce((s, v) => s + v, 0);

    totalScore += Math.min(groupAwarded, criterion.maxMarks);
  }

  const percentageScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  const threshold =
    application.category === "SC_ST" ? scheme.passThresholdScStPct : scheme.passThresholdGeneralPct;

  let verdict: "RECOMMENDED" | "NOT_RECOMMENDED" | "NEEDS_REVIEW";
  if (!eligibilityPassed) {
    verdict = "NOT_RECOMMENDED";
  } else if (presentationPending) {
    verdict = "NEEDS_REVIEW";
  } else if (percentageScore >= threshold) {
    verdict = "RECOMMENDED";
  } else {
    verdict = "NOT_RECOMMENDED";
  }

  await prisma.recommendation.upsert({
    where: { applicationId },
    update: { totalScore, maxScore, percentageScore, eligibilityPassed, verdict },
    create: { applicationId, totalScore, maxScore, percentageScore, eligibilityPassed, verdict },
  });

  const newStatus = !eligibilityPassed
    ? "INELIGIBLE"
    : presentationPending
      ? "ELIGIBLE_PENDING_SCORE"
      : percentageScore >= threshold
        ? "SHORTLISTED_FOR_PRESENTATION"
        : "SCORED";

  await prisma.application.update({
    where: { id: applicationId },
    data: { status: application.status === "APPROVED" ? application.status : newStatus },
  });

  return { eligibilityPassed, totalScore, maxScore, percentageScore, verdict, checks };
}

export { boundKeyForCriterion };

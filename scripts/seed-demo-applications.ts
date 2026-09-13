/**
 * Generates a large, realistic-looking batch of demo applications across all 7
 * schemes so the dashboard, application list and executive reports have enough
 * volume to present. Safe to re-run: it only ever adds applications with
 * applicationNo prefixed "DEMO-" and can be wiped with --wipe.
 */
import { PrismaClient } from "@prisma/client";
import { assessApplication } from "../src/lib/ruleEngine";

const prisma = new PrismaClient();

const TARGET_COUNT = 220;

const STATE_DISTRICTS: Record<string, string[]> = {
  Maharashtra: ["Nashik", "Pune", "Nagpur", "Kolhapur", "Aurangabad"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Meerut", "Varanasi", "Agra"],
  Punjab: ["Ludhiana", "Amritsar", "Jalandhar", "Patiala"],
  Gujarat: ["Ahmedabad", "Surat", "Rajkot", "Vadodara", "Anand"],
  Karnataka: ["Bengaluru Rural", "Belagavi", "Mysuru", "Hubballi"],
  "Tamil Nadu": ["Coimbatore", "Madurai", "Salem", "Erode"],
  "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Ujjain"],
  Rajasthan: ["Jaipur", "Jodhpur", "Udaipur", "Kota"],
  "Andhra Pradesh": ["Guntur", "Krishna", "Chittoor", "Kurnool"],
  Telangana: ["Rangareddy", "Warangal", "Nizamabad"],
  "West Bengal": ["Hooghly", "Nadia", "Murshidabad"],
  Bihar: ["Patna", "Muzaffarpur", "Bhagalpur"],
  Haryana: ["Karnal", "Hisar", "Panipat", "Sonipat"],
  Odisha: ["Cuttack", "Khordha", "Ganjam"],
  Assam: ["Kamrup", "Nagaon", "Jorhat"],
  "Himachal Pradesh": ["Solan", "Kangra", "Mandi"],
  Uttarakhand: ["Udham Singh Nagar", "Dehradun", "Haridwar"],
  "Jammu and Kashmir": ["Jammu", "Anantnag", "Baramulla"],
};

const DIFFICULT_STATES = new Set([
  "Himachal Pradesh",
  "Uttarakhand",
  "Jammu and Kashmir",
  "Assam",
]);

const NAME_PREFIXES = [
  "Bharat", "Annapurna", "Krishna", "Godavari", "Nilgiri", "Sahyadri", "Vindhya",
  "Malwa", "Konkan", "Deccan", "Kaveri", "Narmada", "Tapti", "Satpura", "Aravalli",
  "Himalaya", "Ganga", "Yamuna", "Suvarna", "Rajlaxmi", "Shreeji", "Vasundhara",
  "Amrut", "Kisan", "Sampada", "Utkarsh", "Navjeevan", "Swasthya", "Poorna",
  "Sanjeevani", "Vaibhav", "Suryoday", "Trupti", "Sahakar", "Pragati", "Agroshakti",
];

const NAME_SUFFIXES = [
  "Agro Industries", "Foods Pvt Ltd", "Cold Storage Pvt Ltd", "Processing Ltd",
  "Farmers Producer Company", "AgriTech Pvt Ltd", "Fresh Foods", "Testing Labs Pvt Ltd",
  "Value Chain Pvt Ltd", "Food Park Developers Pvt Ltd", "Agro Cluster LLP",
  "FPO", "Dairy & Food Processing", "Exports Pvt Ltd", "Warehousing Pvt Ltd",
];

const ENTITY_TYPES = [
  "Private Limited Company",
  "Partnership Firm",
  "Farmer Producer Company",
  "Cooperative Society",
  "Proprietorship Firm",
  "LLP",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number, decimals = 1): number {
  const v = Math.random() * (max - min) + min;
  return Number(v.toFixed(decimals));
}
function weightedBool(pTrue: number): boolean {
  return Math.random() < pTrue;
}

function generateName(): string {
  return `${pick(NAME_PREFIXES)} ${pick(NAME_SUFFIXES)}`;
}

// Per-scheme realistic TPC ranges (in INR) and cost-band spread for the scoring engine.
const SCHEME_TPC_RANGE: Record<string, [number, number]> = {
  FTL: [1_00_00_000, 9_00_00_000],
  COLD_CHAIN: [3_00_00_000, 20_00_00_000],
  CEFPPC: [2_00_00_000, 15_00_00_000],
  APC: [5_00_00_000, 25_00_00_000],
  CBFL: [2_00_00_000, 12_00_00_000],
  OPERATION_GREENS: [5_00_00_000, 60_00_00_000],
  MEGA_FOOD_PARK: [50_00_00_000, 3_00_00_00_000],
};

async function main() {
  const wipe = process.argv.includes("--wipe");
  if (wipe) {
    const existing = await prisma.application.findMany({
      where: { applicationNo: { startsWith: "DEMO-" } },
      select: { id: true },
    });
    const ids = existing.map((a) => a.id);
    await prisma.applicationScore.deleteMany({ where: { applicationId: { in: ids } } });
    await prisma.eligibilityCheck.deleteMany({ where: { applicationId: { in: ids } } });
    await prisma.applicationDataValue.deleteMany({ where: { applicationId: { in: ids } } });
    await prisma.applicationDocument.deleteMany({ where: { applicationId: { in: ids } } });
    await prisma.recommendation.deleteMany({ where: { applicationId: { in: ids } } });
    await prisma.application.deleteMany({ where: { id: { in: ids } } });
    console.log(`Wiped ${ids.length} existing demo applications.`);
  }

  const schemes = await prisma.scheme.findMany({ include: { criteria: true } });
  const states = Object.keys(STATE_DISTRICTS);

  let created = 0;
  const perScheme = Math.ceil(TARGET_COUNT / schemes.length);

  for (const scheme of schemes) {
    const childCodes = new Set(scheme.criteria.filter((c) => c.parentCode).map((c) => c.parentCode));
    const booleanLeaves = scheme.criteria.filter(
      (c) => c.stage === "DOCUMENT" && c.inputType === "BOOLEAN" && !childCodes.has(c.code)
    );
    const presentationLeaves = scheme.criteria.filter(
      (c) => c.stage === "PRESENTATION" && !childCodes.has(c.code)
    );

    const existingCount = await prisma.application.count({ where: { schemeId: scheme.id } });

    for (let i = 0; i < perScheme && created < TARGET_COUNT; i++) {
      const state = pick(states);
      const district = pick(STATE_DISTRICTS[state]);
      const isDifficultArea = DIFFICULT_STATES.has(state) || weightedBool(0.08);

      const categoryRoll = Math.random();
      const category =
        categoryRoll < 0.62 ? "GENERAL" : categoryRoll < 0.75 ? "SC_ST" : categoryRoll < 0.9 ? "WOMEN" : "FPO";
      const isPriority = isDifficultArea || category === "SC_ST" || category === "FPO";

      const [tpcMin, tpcMax] = SCHEME_TPC_RANGE[scheme.code] ?? [1_00_00_000, 10_00_00_000];
      const totalProjectCost = randInt(Math.round(tpcMin / 1_00_000), Math.round(tpcMax / 1_00_000)) * 1_00_000;
      const eligibleProjectCost = Math.round(totalProjectCost * randFloat(0.82, 0.96, 2));
      const subsidyPct = isPriority ? scheme.subsidyDifficultPct : scheme.subsidyGeneralPct;
      const subsidySought = Math.min(
        Math.round(eligibleProjectCost * (subsidyPct / 100)),
        scheme.subsidyCapAmount
      );

      // ~78% of applicants clear the eligibility gate comfortably; ~22% fall short on
      // one or more parameters, to give a realistic ineligible slice for the dashboard.
      const strongApplicant = weightedBool(0.78);

      const minEquity = isPriority ? scheme.minEquityDifficultPct : scheme.minEquityGeneralPct;
      const minLoan = isPriority ? scheme.minTermLoanDifficultPct : scheme.minTermLoanGeneralPct;
      const equityPct = strongApplicant ? randFloat(minEquity, minEquity + 20) : randFloat(Math.max(0, minEquity - 12), minEquity - 1);
      const termLoanPct = strongApplicant ? randFloat(minLoan, minLoan + 25) : randFloat(Math.max(0, minLoan - 10), minLoan - 1);
      const netWorthMultiplier = isPriority ? scheme.netWorthMultiplierDifficult : scheme.netWorthMultiplierGeneral;
      const netWorth = strongApplicant
        ? Math.round(subsidySought * netWorthMultiplier * randFloat(1.05, 2.2, 2))
        : Math.round(subsidySought * netWorthMultiplier * randFloat(0.4, 0.95, 2));

      const hasDetailedAppraisalNote = strongApplicant ? weightedBool(0.96) : weightedBool(0.6);
      const hasStatutoryDocs = strongApplicant ? weightedBool(0.97) : weightedBool(0.65);
      const isInsolvent = weightedBool(0.02);
      const coolOffSatisfied = weightedBool(0.94);
      const maxProjectsSatisfied = weightedBool(0.97);

      const irrPct = randFloat(6, 32);
      const avgDscr = randFloat(1.1, 3.6, 2);

      const dataEntries: { fieldKey: string; fieldValue: string }[] = [
        { fieldKey: "subsidySought", fieldValue: String(subsidySought) },
        { fieldKey: "eligibleProjectCostCr", fieldValue: String(eligibleProjectCost / 1_00_00_000) },
        { fieldKey: "equityPct", fieldValue: String(equityPct) },
        { fieldKey: "termLoanPct", fieldValue: String(termLoanPct) },
        { fieldKey: "netWorth", fieldValue: String(netWorth) },
        { fieldKey: "irrPct", fieldValue: String(irrPct) },
        { fieldKey: "avgDscr", fieldValue: String(avgDscr) },
        { fieldKey: "hasDetailedAppraisalNote", fieldValue: String(hasDetailedAppraisalNote) },
        { fieldKey: "hasStatutoryDocs", fieldValue: String(hasStatutoryDocs) },
        { fieldKey: "isInsolvent", fieldValue: String(isInsolvent) },
        { fieldKey: "coolOffSatisfied", fieldValue: String(coolOffSatisfied) },
        { fieldKey: "maxProjectsSatisfied", fieldValue: String(maxProjectsSatisfied) },
      ];
      if (category === "SC_ST") {
        dataEntries.push({ fieldKey: "isScSt", fieldValue: "true" });
        dataEntries.push({ fieldKey: "scstNetWorthSharePct", fieldValue: String(randInt(10, 60)) });
      }

      // Scoring declarations: pick one tier per alternative-group randomly (weighted so
      // stronger applicants tend to land the higher tiers), plus independent booleans.
      const groups = new Map<string, typeof booleanLeaves>();
      for (const c of booleanLeaves) {
        const groupKey = c.parentCode ?? c.code;
        const list = groups.get(groupKey) ?? [];
        list.push(c);
        groups.set(groupKey, list);
      }
      for (const [, members] of groups) {
        if (members.length > 1) {
          // alternative tiers within a group (e.g. land 1.1/1.2/1.3): pick at most one
          const roll = Math.random();
          const tierIdx = strongApplicant
            ? roll < 0.55
              ? 0
              : roll < 0.85
                ? 1
                : 2
            : roll < 0.15
              ? 0
              : roll < 0.45
                ? 1
                : 2;
          const chosen = members[Math.min(tierIdx, members.length - 1)];
          for (const m of members) {
            dataEntries.push({
              fieldKey: `crit_${m.code.replace(/\./g, "_")}`,
              fieldValue: String(m.code === chosen.code && weightedBool(0.85)),
            });
          }
        } else {
          const m = members[0];
          const p = strongApplicant ? 0.55 : 0.3;
          dataEntries.push({
            fieldKey: `crit_${m.code.replace(/\./g, "_")}`,
            fieldValue: String(weightedBool(p)),
          });
        }
      }

      const applicationNo = `DEMO-${scheme.code}-${String(existingCount + i + 1).padStart(4, "0")}`;
      const createdAt = new Date(Date.now() - randInt(1, 210) * 24 * 60 * 60 * 1000);

      const application = await prisma.application.create({
        data: {
          applicationNo,
          schemeId: scheme.id,
          applicantName: generateName(),
          entityType: pick(ENTITY_TYPES),
          category,
          isDifficultArea,
          state,
          district,
          totalProjectCost,
          eligibleProjectCost,
          subsidySought,
          status: "SUBMITTED",
          submittedAt: createdAt,
          createdAt,
        },
      });

      await prisma.applicationDataValue.createMany({
        data: dataEntries
          .filter((e) => e.fieldValue !== "")
          .map((e) => ({ applicationId: application.id, ...e })),
      });

      const result = await assessApplication(application.id);

      // Simulate downstream PAC activity for a realistic status mix: for shortlisted /
      // pending-review applications, most get a presentation score; a portion of those
      // recommended-after-presentation are then finalized as Approved/Rejected.
      if (result.eligibilityPassed && presentationLeaves.length > 0 && weightedBool(0.7)) {
        for (const p of presentationLeaves) {
          const scorePct = strongApplicant ? randFloat(0.65, 1.0) : randFloat(0.35, 0.85);
          const marks = Math.round(p.maxMarks * scorePct * 2) / 2;
          await prisma.applicationScore.create({
            data: { applicationId: application.id, criterionId: p.id, marksAwarded: marks },
          });
        }
        const rescored = await assessApplication(application.id);

        if (rescored.verdict === "RECOMMENDED" && weightedBool(0.72)) {
          await prisma.application.update({ where: { id: application.id }, data: { status: "APPROVED" } });
        } else if (rescored.verdict === "NOT_RECOMMENDED" && weightedBool(0.3)) {
          await prisma.application.update({ where: { id: application.id }, data: { status: "REJECTED" } });
        } else {
          await prisma.application.update({ where: { id: application.id }, data: { status: "PRESENTED" } });
        }
      }

      created++;
    }
  }

  console.log(`Created ${created} demo applications across ${schemes.length} schemes.`);

  const total = await prisma.application.count();
  const byStatus = await prisma.application.groupBy({ by: ["status"], _count: true });
  console.log(`Total applications in DB: ${total}`);
  console.log("By status:", byStatus.map((s) => `${s.status}=${s._count}`).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

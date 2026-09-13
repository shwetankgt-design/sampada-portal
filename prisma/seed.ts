import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type CriterionSeed = {
  code: string;
  parentCode?: string;
  category: string;
  label: string;
  maxMarks: number;
  stage?: "DOCUMENT" | "PRESENTATION";
  inputType?: "MANUAL" | "BAND" | "BOOLEAN";
  bandConfig?: unknown;
  sortOrder: number;
};

type SchemeSeed = {
  code: string;
  name: string;
  shortName: string;
  description: string;
  guidelineDate: string;
  subsidyGeneralPct: number;
  subsidyDifficultPct: number;
  subsidyCapAmount: number;
  subsidyCapLabel: string;
  minEquityGeneralPct?: number;
  minEquityDifficultPct?: number;
  minTermLoanGeneralPct?: number;
  minTermLoanDifficultPct?: number;
  netWorthMultiplierGeneral?: number;
  netWorthMultiplierDifficult?: number;
  criteria: CriterionSeed[];
};

// ---- Shared criterion blocks (the common PMKSY evaluation skeleton, confirmed
// across FTL / Cold Chain / CEFPPC / APC / CBFL / Operation Greens guidelines) ----

function economicViability(): CriterionSeed[] {
  return [
    {
      code: "2",
      category: "Economic Viability of Project (Bank Appraisal)",
      label: "Economic Viability of Project Based on Bank Appraisal (IRR, Avg DSCR)",
      maxMarks: 15,
      sortOrder: 20,
    },
    {
      code: "2.1",
      parentCode: "2",
      category: "Economic Viability of Project (Bank Appraisal)",
      label: "IRR band score (>=20%: 8, >=15%&<20%: 5, >=10%&<15%: 2, <10%: 0)",
      maxMarks: 8,
      inputType: "BAND",
      bandConfig: {
        field: "irrPct",
        bands: [
          { min: 20, marks: 8 },
          { min: 15, marks: 5 },
          { min: 10, marks: 2 },
          { min: 0, marks: 0 },
        ],
      },
      sortOrder: 21,
    },
    {
      code: "2.2",
      parentCode: "2",
      category: "Economic Viability of Project (Bank Appraisal)",
      label: "Average DSCR band score (>=2.5: 7, >=2.0&<2.5: 4, >=1.5&<2.0: 2, <1.5: 0)",
      maxMarks: 7,
      inputType: "BAND",
      bandConfig: {
        field: "avgDscr",
        bands: [
          { min: 2.5, marks: 7 },
          { min: 2.0, marks: 4 },
          { min: 1.5, marks: 2 },
          { min: 0, marks: 0 },
        ],
      },
      sortOrder: 22,
    },
  ];
}

function projectCostBand(label = "Eligible Project Cost"): CriterionSeed[] {
  return [
    {
      code: "3",
      category: label,
      label: `${label} (as per DPR and Bank Appraisal Report)`,
      maxMarks: 10,
      inputType: "BAND",
      bandConfig: {
        field: "eligibleProjectCostCr",
        bands: [
          { min: 10, marks: 10 },
          { min: 7, marks: 7 },
          { min: 0, marks: 3 },
        ],
      },
      sortOrder: 30,
    },
  ];
}

function msmeWomenPriorSubsidy(schemeLabel: string): CriterionSeed[] {
  return [
    {
      code: "5",
      category: "MSME Sector",
      label: "Proposal from MSME sector (UDYAM MSME Registration)",
      maxMarks: 7,
      inputType: "BOOLEAN",
      sortOrder: 50,
    },
    {
      code: "6",
      category: "Women Entrepreneur",
      label: "Proposal from a Woman entrepreneur (>=51% stake, MOA/Deed/Balance Sheet)",
      maxMarks: 3,
      inputType: "BOOLEAN",
      sortOrder: 60,
    },
    {
      code: "7",
      parentCode: undefined,
      category: "Prior Subsidy Availed",
      label: "Prior subsidy availed under the scheme",
      maxMarks: 10,
      sortOrder: 70,
    },
    {
      code: "7.1",
      parentCode: "7",
      category: "Prior Subsidy Availed",
      label: `Entity has never received subsidy under ${schemeLabel} (Undertaking)`,
      maxMarks: 10,
      inputType: "BOOLEAN",
      sortOrder: 71,
    },
    {
      code: "7.2",
      parentCode: "7",
      category: "Prior Subsidy Availed",
      label: "Entity previously assisted, but proposes a unit in a new district with no existing facility (Undertaking)",
      maxMarks: 5,
      inputType: "BOOLEAN",
      sortOrder: 72,
    },
  ];
}

function presentation(): CriterionSeed[] {
  return [
    {
      code: "10",
      category: "Technical Presentation before PAC",
      label: "Technical Presentation by the eligible promoters before the Project Approval Committee (PAC)",
      maxMarks: 15,
      stage: "PRESENTATION",
      sortOrder: 100,
    },
    {
      code: "10.1",
      parentCode: "10",
      category: "Technical Presentation before PAC",
      label: "Presentation and explanation of Business Model",
      maxMarks: 10,
      stage: "PRESENTATION",
      sortOrder: 101,
    },
    {
      code: "10.2",
      parentCode: "10",
      category: "Technical Presentation before PAC",
      label: "Implementation Schedule and Feasibility of the project",
      maxMarks: 5,
      stage: "PRESENTATION",
      sortOrder: 102,
    },
  ];
}

function land(sub15Label: string, sub10Label: string, sub5Label: string): CriterionSeed[] {
  return [
    {
      code: "1",
      category: "Possession of Appropriate Land or Building",
      label: "Possession of Appropriate Land or Building",
      maxMarks: 15,
      sortOrder: 10,
    },
    { code: "1.1", parentCode: "1", category: "Possession of Appropriate Land or Building", label: sub15Label, maxMarks: 15, inputType: "BOOLEAN", sortOrder: 11 },
    { code: "1.2", parentCode: "1", category: "Possession of Appropriate Land or Building", label: sub10Label, maxMarks: 10, inputType: "BOOLEAN", sortOrder: 12 },
    { code: "1.3", parentCode: "1", category: "Possession of Appropriate Land or Building", label: sub5Label, maxMarks: 5, inputType: "BOOLEAN", sortOrder: 13 },
  ];
}

const LAND_STANDARD = land(
  "Complete land title (sale deed/registered lease/possession or allotment letter from State Govt./MFP/APC) in the name of PIA, with CLU",
  "Complete land title as above but without CLU",
  "Agreement to Sale/Purchase of Land/Building in the name of PIA"
);

// ---------------- Scheme 1: Food Testing Laboratory (fully sourced from guideline dated 12.11.2025) ----------------
const FTL: SchemeSeed = {
  code: "FTL",
  name: "Food Safety & Quality Assurance Infrastructure - Setting up of Food Testing Laboratory",
  shortName: "Food Testing Laboratory (FTL)",
  description:
    "Financial assistance for setting up new food-testing laboratories exclusively for commercial food testing, to strengthen food-testing infrastructure and reduce turnaround time for sample analysis.",
  guidelineDate: "12.11.2025",
  subsidyGeneralPct: 50,
  subsidyDifficultPct: 70,
  subsidyCapAmount: 50000000,
  subsidyCapLabel: "Rs. 5.00 crore per project",
  criteria: [
    ...LAND_STANDARD,
    ...economicViability(),
    ...projectCostBand(),
    {
      code: "4",
      category: "Hi-end Equipment",
      label: "Hi-end equipment: GC-MS/MS, LC-MS/MS, LC-ICPMS, NMR, HPLC, IRMS, HRMS",
      maxMarks: 15,
      sortOrder: 40,
    },
    { code: "4.1", parentCode: "4", category: "Hi-end Equipment", label: "Proposal includes more than 3 of the specified hi-end equipment", maxMarks: 15, inputType: "BOOLEAN", sortOrder: 41 },
    { code: "4.2", parentCode: "4", category: "Hi-end Equipment", label: "Proposal includes any 3 of the specified 5 hi-end equipment", maxMarks: 10, inputType: "BOOLEAN", sortOrder: 42 },
    { code: "4.3", parentCode: "4", category: "Hi-end Equipment", label: "Proposal includes any 2 of the specified 5 hi-end equipment", maxMarks: 6, inputType: "BOOLEAN", sortOrder: 43 },
    ...msmeWomenPriorSubsidy("the FSQAI component scheme"),
    {
      code: "8",
      category: "District NABL Gap",
      label: "Project proposed in a District where NABL-accredited Food Testing Laboratory is not available",
      maxMarks: 5,
      inputType: "BOOLEAN",
      sortOrder: 80,
    },
    {
      code: "9",
      category: "Logistics / Connectivity",
      label: "Project within logistically viable distance (up to 100 km) from major airports/ports",
      maxMarks: 5,
      inputType: "BOOLEAN",
      sortOrder: 90,
    },
    ...presentation(),
  ],
};

// ---------------- Scheme 2: Integrated Cold Chain, Value Addition and Preservation Infrastructure ----------------
const COLD_CHAIN: SchemeSeed = {
  code: "COLD_CHAIN",
  name: "Integrated Cold Chain, Value Addition and Preservation Infrastructure",
  shortName: "Cold Chain",
  description:
    "Provides integrated cold chain, preservation and value addition infrastructure without break, from farm gate to consumer, for non-horticulture produce, dairy, meat, poultry and marine/fish.",
  guidelineDate: "22.05.2025",
  subsidyGeneralPct: 35,
  subsidyDifficultPct: 50,
  subsidyCapAmount: 100000000,
  subsidyCapLabel: "Rs. 10.00 crore per project",
  criteria: [
    ...LAND_STANDARD,
    ...economicViability(),
    ...projectCostBand(),
    {
      code: "4",
      category: "Advanced Cold-Chain Technology",
      label: "Advanced technology components: IQF/Tunnel/Spiral/Blast/Plate Freezer, CA/MA storage, AI/IoT/SCADA integration",
      maxMarks: 15,
      sortOrder: 40,
    },
    { code: "4.1", parentCode: "4", category: "Advanced Cold-Chain Technology", label: "Proposal includes more than 3 of the specified advanced technology components", maxMarks: 15, inputType: "BOOLEAN", sortOrder: 41 },
    { code: "4.2", parentCode: "4", category: "Advanced Cold-Chain Technology", label: "Proposal includes any 3 of the specified 5 advanced technology components", maxMarks: 10, inputType: "BOOLEAN", sortOrder: 42 },
    { code: "4.3", parentCode: "4", category: "Advanced Cold-Chain Technology", label: "Proposal includes any 2 of the specified 5 advanced technology components", maxMarks: 6, inputType: "BOOLEAN", sortOrder: 43 },
    ...msmeWomenPriorSubsidy("the Cold Chain scheme"),
    {
      code: "8",
      category: "Regional Cold-Storage Gap",
      label: "Project proposed in a district/region with inadequate cold-chain infrastructure",
      maxMarks: 5,
      inputType: "BOOLEAN",
      sortOrder: 80,
    },
    {
      code: "9",
      category: "Logistics / Connectivity",
      label: "Project within logistically viable distance from production catchment / major transport corridor",
      maxMarks: 5,
      inputType: "BOOLEAN",
      sortOrder: 90,
    },
    ...presentation(),
  ],
};

// ---------------- Scheme 3: Creation/Expansion of Food Processing/Preservation Capacities (CEFPPC / Unit Scheme) ----------------
const CEFPPC: SchemeSeed = {
  code: "CEFPPC",
  name: "Creation/Expansion of Food Processing & Preservation Capacities (CEFPPC / Unit Scheme)",
  shortName: "CEFPPC (Unit Scheme)",
  description:
    "Supports creation of new processing/preservation capacity and expansion of existing food processing units to increase level of processing, value addition and reduce food loss.",
  guidelineDate: "22.01.2025",
  subsidyGeneralPct: 35,
  subsidyDifficultPct: 50,
  subsidyCapAmount: 50000000,
  subsidyCapLabel: "Rs. 5.00 crore per project (indicative, verify against latest guideline)",
  criteria: [
    ...LAND_STANDARD,
    ...economicViability(),
    ...projectCostBand(),
    {
      code: "4",
      category: "Processing Technology & Value Addition",
      label: "Level of automation / processing technology and share of high-value or export-oriented segments",
      maxMarks: 15,
      sortOrder: 40,
    },
    { code: "4.1", parentCode: "4", category: "Processing Technology & Value Addition", label: "High level of automation with more than 3 specialised processing/preservation lines", maxMarks: 15, inputType: "BOOLEAN", sortOrder: 41 },
    { code: "4.2", parentCode: "4", category: "Processing Technology & Value Addition", label: "Any 3 specialised processing/preservation lines", maxMarks: 10, inputType: "BOOLEAN", sortOrder: 42 },
    { code: "4.3", parentCode: "4", category: "Processing Technology & Value Addition", label: "Any 2 specialised processing/preservation lines", maxMarks: 6, inputType: "BOOLEAN", sortOrder: 43 },
    ...msmeWomenPriorSubsidy("the CEFPPC scheme"),
    {
      code: "8",
      category: "District Processing Capacity Gap",
      label: "Project proposed in a district with limited existing processing capacity for the segment",
      maxMarks: 5,
      inputType: "BOOLEAN",
      sortOrder: 80,
    },
    {
      code: "9",
      category: "Raw Material Proximity",
      label: "Project within logistically viable distance from raw-material producing cluster",
      maxMarks: 5,
      inputType: "BOOLEAN",
      sortOrder: 90,
    },
    ...presentation(),
  ],
};

// ---------------- Scheme 4: Agro Processing Cluster (APC) ----------------
const APC: SchemeSeed = {
  code: "APC",
  name: "Creation of Infrastructure for Agro Processing Clusters (APC)",
  shortName: "Agro Processing Cluster (APC)",
  description:
    "Development of modern common infrastructure and basic enabling infrastructure on a cluster basis, linking groups of producers/farmers to processors and markets, with at least 5 food processing units per cluster.",
  guidelineDate: "25.04.2025",
  subsidyGeneralPct: 35,
  subsidyDifficultPct: 50,
  subsidyCapAmount: 100000000,
  subsidyCapLabel: "Rs. 10.00 crore per project (indicative, verify against latest guideline)",
  criteria: [
    ...LAND_STANDARD,
    ...economicViability(),
    ...projectCostBand(),
    {
      code: "4",
      category: "Cluster Scale & Diversity",
      label: "Number and diversity of committed food-processing units in the cluster (norm: 5-10 units)",
      maxMarks: 15,
      sortOrder: 40,
    },
    { code: "4.1", parentCode: "4", category: "Cluster Scale & Diversity", label: "8 or more committed units with diverse product segments", maxMarks: 15, inputType: "BOOLEAN", sortOrder: 41 },
    { code: "4.2", parentCode: "4", category: "Cluster Scale & Diversity", label: "6-7 committed units", maxMarks: 10, inputType: "BOOLEAN", sortOrder: 42 },
    { code: "4.3", parentCode: "4", category: "Cluster Scale & Diversity", label: "5 (minimum required) committed units", maxMarks: 6, inputType: "BOOLEAN", sortOrder: 43 },
    ...msmeWomenPriorSubsidy("the APC scheme"),
    {
      code: "8",
      category: "Identified Cluster Priority",
      label: "Cluster located in identified agri-horti / export-oriented cluster (Appendix-I/II of scheme guideline)",
      maxMarks: 5,
      inputType: "BOOLEAN",
      sortOrder: 80,
    },
    {
      code: "9",
      category: "Market / Port Connectivity",
      label: "Project within logistically viable distance from major markets/ports",
      maxMarks: 5,
      inputType: "BOOLEAN",
      sortOrder: 90,
    },
    ...presentation(),
  ],
};

// ---------------- Scheme 5: Creation of Backward and Forward Linkages (CBFL) ----------------
const CBFL: SchemeSeed = {
  code: "CBFL",
  name: "Creation of Backward and Forward Linkages (CBFL)",
  shortName: "Backward & Forward Linkages (CBFL)",
  description:
    "Assistance for integrated backward linkage (pack-houses, milk chilling, pre-cooling, primary processing) and forward linkage (retail chain, distribution centres) with controlled-temperature transport.",
  guidelineDate: "22.02.2018",
  subsidyGeneralPct: 35,
  subsidyDifficultPct: 50,
  subsidyCapAmount: 50000000,
  subsidyCapLabel: "Rs. 5.00 crore per project",
  netWorthMultiplierGeneral: 1.0,
  netWorthMultiplierDifficult: 1.0,
  criteria: [
    ...LAND_STANDARD,
    ...economicViability(),
    ...projectCostBand(),
    {
      code: "4",
      category: "Linkage Completeness",
      label: "Completeness of backward + forward linkage (pack-house, transport and retail/distribution components together)",
      maxMarks: 15,
      sortOrder: 40,
    },
    { code: "4.1", parentCode: "4", category: "Linkage Completeness", label: "Backward, forward and transport components all included", maxMarks: 15, inputType: "BOOLEAN", sortOrder: 41 },
    { code: "4.2", parentCode: "4", category: "Linkage Completeness", label: "Backward + forward components included (transport optional)", maxMarks: 10, inputType: "BOOLEAN", sortOrder: 42 },
    { code: "4.3", parentCode: "4", category: "Linkage Completeness", label: "Only one of backward/forward linkage included", maxMarks: 6, inputType: "BOOLEAN", sortOrder: 43 },
    ...msmeWomenPriorSubsidy("the CBFL scheme"),
    {
      code: "8",
      category: "District Linkage Infrastructure Gap",
      label: "Project proposed in a district with inadequate backward/forward linkage infrastructure",
      maxMarks: 5,
      inputType: "BOOLEAN",
      sortOrder: 80,
    },
    {
      code: "9",
      category: "Farm Cluster Proximity",
      label: "Project within logistically viable distance from farm-level production clusters",
      maxMarks: 5,
      inputType: "BOOLEAN",
      sortOrder: 90,
    },
    ...presentation(),
  ],
};

// ---------------- Scheme 6: Operation Greens ----------------
const OPERATION_GREENS: SchemeSeed = {
  code: "OPERATION_GREENS",
  name: "Operation Greens - Integrated Value Chain Development & Standalone Post-Harvest Infrastructure",
  shortName: "Operation Greens",
  description:
    "Enhances value realisation of farmers for 22 notified perishable crops (TOP + others) by strengthening production clusters/FPOs, reducing post-harvest losses and building agri-logistics and processing capacity.",
  guidelineDate: "08.06.2022",
  subsidyGeneralPct: 35,
  subsidyDifficultPct: 50,
  subsidyCapAmount: 500000000,
  subsidyCapLabel: "Rs. 50.00 crore per project (Long Term Interventions, indicative)",
  criteria: [
    ...LAND_STANDARD,
    ...economicViability(),
    ...projectCostBand(),
    {
      code: "4",
      category: "Value Chain Integration",
      label: "Degree of farm-to-retail value chain integration (primary processing, distribution, retail, digital traceability)",
      maxMarks: 15,
      sortOrder: 40,
    },
    { code: "4.1", parentCode: "4", category: "Value Chain Integration", label: "End-to-end integration: farm-level infra + processing + distribution + retail", maxMarks: 15, inputType: "BOOLEAN", sortOrder: 41 },
    { code: "4.2", parentCode: "4", category: "Value Chain Integration", label: "Any 3 of the above value-chain stages covered", maxMarks: 10, inputType: "BOOLEAN", sortOrder: 42 },
    { code: "4.3", parentCode: "4", category: "Value Chain Integration", label: "Any 2 of the above value-chain stages covered", maxMarks: 6, inputType: "BOOLEAN", sortOrder: 43 },
    ...msmeWomenPriorSubsidy("Operation Greens"),
    {
      code: "8",
      category: "Notified Crop Cluster Priority",
      label: "Project located in / sourcing from a notified TOP/22-crop production cluster",
      maxMarks: 5,
      inputType: "BOOLEAN",
      sortOrder: 80,
    },
    {
      code: "9",
      category: "Logistics Connectivity",
      label: "Project within logistically viable distance from production cluster / mandi / consumption centre",
      maxMarks: 5,
      inputType: "BOOLEAN",
      sortOrder: 90,
    },
    ...presentation(),
  ],
};

// ---------------- Scheme 7: Mega Food Park (MFP) ----------------
const MEGA_FOOD_PARK: SchemeSeed = {
  code: "MEGA_FOOD_PARK",
  name: "Mega Food Park Scheme (MFPS)",
  shortName: "Mega Food Park (MFP)",
  description:
    "Cluster-based modern infrastructure for food processing along the value chain from farm to market, through a Central Processing Centre supported by Primary Processing Centres and Collection Centres, implemented via an SPV.",
  guidelineDate: "21.07.2016 (base, with amendments through 2021)",
  subsidyGeneralPct: 50,
  subsidyDifficultPct: 75,
  subsidyCapAmount: 500000000,
  subsidyCapLabel: "Rs. 50.00 crore per project",
  criteria: [
    ...land(
      "Complete land title for 50+ acres (CPC) with CLU, in the name of the SPV",
      "Complete land title for 50+ acres (CPC) without CLU / registered lease of at least 75 years",
      "Agreement to Sale/Purchase of Land in the name of the SPV"
    ),
    ...economicViability(),
    ...projectCostBand("Eligible Project Cost (min. project envisages ~Rs. 250 crore collective investment)"),
    {
      code: "4",
      category: "Committed Processing Units & Diversity",
      label: "Number and diversity of committed food-processing units in the Park (norm: 25-30 units)",
      maxMarks: 15,
      sortOrder: 40,
    },
    { code: "4.1", parentCode: "4", category: "Committed Processing Units & Diversity", label: "20 or more committed units across diverse product segments", maxMarks: 15, inputType: "BOOLEAN", sortOrder: 41 },
    { code: "4.2", parentCode: "4", category: "Committed Processing Units & Diversity", label: "10-19 committed units", maxMarks: 10, inputType: "BOOLEAN", sortOrder: 42 },
    { code: "4.3", parentCode: "4", category: "Committed Processing Units & Diversity", label: "5-9 committed units", maxMarks: 6, inputType: "BOOLEAN", sortOrder: 43 },
    ...msmeWomenPriorSubsidy("the Mega Food Park scheme"),
    {
      code: "8",
      category: "Regional Priority",
      label: "State/region does not already have an operational Mega Food Park",
      maxMarks: 5,
      inputType: "BOOLEAN",
      sortOrder: 80,
    },
    {
      code: "9",
      category: "Transport Corridor Connectivity",
      label: "Project within logistically viable distance from a major transport corridor / airport / port",
      maxMarks: 5,
      inputType: "BOOLEAN",
      sortOrder: 90,
    },
    ...presentation(),
  ],
};

const SCHEMES: SchemeSeed[] = [
  FTL,
  COLD_CHAIN,
  CEFPPC,
  APC,
  CBFL,
  OPERATION_GREENS,
  MEGA_FOOD_PARK,
];

async function main() {
  console.log("Seeding schemes and scoring criteria...");

  for (const s of SCHEMES) {
    const scheme = await prisma.scheme.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        shortName: s.shortName,
        description: s.description,
        guidelineDate: s.guidelineDate,
        subsidyGeneralPct: s.subsidyGeneralPct,
        subsidyDifficultPct: s.subsidyDifficultPct,
        subsidyCapAmount: s.subsidyCapAmount,
        subsidyCapLabel: s.subsidyCapLabel,
        minEquityGeneralPct: s.minEquityGeneralPct ?? 20,
        minEquityDifficultPct: s.minEquityDifficultPct ?? 10,
        minTermLoanGeneralPct: s.minTermLoanGeneralPct ?? 20,
        minTermLoanDifficultPct: s.minTermLoanDifficultPct ?? 10,
        netWorthMultiplierGeneral: s.netWorthMultiplierGeneral ?? 1.0,
        netWorthMultiplierDifficult: s.netWorthMultiplierDifficult ?? 1.0,
      },
      create: {
        code: s.code,
        name: s.name,
        shortName: s.shortName,
        description: s.description,
        guidelineDate: s.guidelineDate,
        subsidyGeneralPct: s.subsidyGeneralPct,
        subsidyDifficultPct: s.subsidyDifficultPct,
        subsidyCapAmount: s.subsidyCapAmount,
        subsidyCapLabel: s.subsidyCapLabel,
        minEquityGeneralPct: s.minEquityGeneralPct ?? 20,
        minEquityDifficultPct: s.minEquityDifficultPct ?? 10,
        minTermLoanGeneralPct: s.minTermLoanGeneralPct ?? 20,
        minTermLoanDifficultPct: s.minTermLoanDifficultPct ?? 10,
        netWorthMultiplierGeneral: s.netWorthMultiplierGeneral ?? 1.0,
        netWorthMultiplierDifficult: s.netWorthMultiplierDifficult ?? 1.0,
      },
    });

    // wipe & recreate criteria for idempotent re-seed
    await prisma.scoringCriterion.deleteMany({ where: { schemeId: scheme.id } });
    for (const c of s.criteria) {
      await prisma.scoringCriterion.create({
        data: {
          schemeId: scheme.id,
          code: c.code,
          parentCode: c.parentCode ?? null,
          category: c.category,
          label: c.label,
          maxMarks: c.maxMarks,
          sortOrder: c.sortOrder,
          stage: c.stage ?? "DOCUMENT",
          inputType: c.inputType ?? "MANUAL",
          bandConfig: c.bandConfig ? JSON.stringify(c.bandConfig) : null,
        },
      });
    }
    console.log(`  seeded ${s.code} with ${s.criteria.length} criteria`);
  }

  // Seed demo users
  const users = [
    { name: "Admin User", email: "admin@sampada-portal.local", role: "ADMIN" as const },
    { name: "Scrutiny Officer", email: "officer@sampada-portal.local", role: "OFFICER" as const },
    { name: "PAC Approver", email: "approver@sampada-portal.local", role: "APPROVER" as const },
    { name: "Joint Secretary (Executive)", email: "executive@sampada-portal.local", role: "EXECUTIVE" as const },
  ];
  const passwordHash = await bcrypt.hash("Password@123", 10);
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, role: u.role, passwordHash },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

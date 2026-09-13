/**
 * Backfills the ministry-facing "Grant Monitoring" data points onto existing
 * schemes and already-approved applications:
 *   - Scheme budget allocation + EOI release/closing dates
 *   - Application approval letter date + final approved grant amount
 *   - Disbursement schedule (1st / 2nd / Final instalment) with a realistic
 *     mix of released, delayed (with reason + revised date) and still-planned
 *     instalments, so the Grant Monitoring Dashboard has something to show.
 *
 * Safe to re-run: it wipes and regenerates Disbursement rows each time.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

// Illustrative FY budget allocation (INR) and EOI cycle per scheme. FTL is fully
// populated as the primary illustration for the ministry review; other schemes
// carry reasonable figures too so the portfolio-wide calendar view is meaningful.
const SCHEME_GRANT_CONFIG: Record<
  string,
  { budgetCr: number; eoiRelease: string; eoiClose: string; outerSubmissionDays: number }
> = {
  FTL: { budgetCr: 150, eoiRelease: "2026-01-15", eoiClose: "2026-03-15", outerSubmissionDays: 60 },
  COLD_CHAIN: { budgetCr: 900, eoiRelease: "2025-08-20", eoiClose: "2026-09-30", outerSubmissionDays: 60 },
  CEFPPC: { budgetCr: 500, eoiRelease: "2025-11-01", eoiClose: "2026-01-31", outerSubmissionDays: 60 },
  APC: { budgetCr: 600, eoiRelease: "2025-12-01", eoiClose: "2026-02-28", outerSubmissionDays: 60 },
  CBFL: { budgetCr: 300, eoiRelease: "2025-10-15", eoiClose: "2025-12-31", outerSubmissionDays: 60 },
  OPERATION_GREENS: { budgetCr: 500, eoiRelease: "2025-09-01", eoiClose: "2025-11-15", outerSubmissionDays: 60 },
  MEGA_FOOD_PARK: { budgetCr: 1200, eoiRelease: "2025-07-01", eoiClose: "2025-10-31", outerSubmissionDays: 90 },
};

const DELAY_REASONS = [
  "Bank Guarantee renewal pending from the PIA",
  "NABL accreditation certificate awaited from applicant",
  "Utilization Certificate for previous instalment yet to be submitted",
  "Site inspection report from the regional office pending",
  "Chartered Engineer completion certificate awaited",
  "PFMS bank account validation pending",
  "Fund availability constraint at Ministry level for this quarter",
  "Applicant requested extension due to equipment import delay",
];

async function main() {
  console.log("Updating scheme budget allocation and EOI cycle dates...");
  for (const [code, cfg] of Object.entries(SCHEME_GRANT_CONFIG)) {
    await prisma.scheme.update({
      where: { code },
      data: {
        budgetAllocationAmount: cfg.budgetCr * 1_00_00_000,
        eoiReleaseDate: new Date(cfg.eoiRelease),
        eoiClosingDate: new Date(cfg.eoiClose),
        outerSubmissionDays: cfg.outerSubmissionDays,
      },
    });
  }

  const approvedApps = await prisma.application.findMany({
    where: { status: "APPROVED" },
    include: { scheme: true },
  });
  console.log(`Found ${approvedApps.length} approved applications to backfill.`);

  // Clean slate for disbursements so this script is safely re-runnable.
  await prisma.disbursement.deleteMany({
    where: { applicationId: { in: approvedApps.map((a) => a.id) } },
  });

  const today = new Date();
  let disbCount = 0;

  for (const app of approvedApps) {
    // An already-APPROVED application must have an approval letter date in the past —
    // clamp so demo data never shows an approval letter dated after "today".
    let approvalLetterDate = addDays(app.createdAt, randInt(25, 55));
    const latestAllowed = addDays(today, -5);
    if (approvalLetterDate > latestAllowed) approvalLetterDate = latestAllowed;
    const approvedGrantAmount = Math.round((app.subsidySought || 0) * (randInt(92, 100) / 100));

    await prisma.application.update({
      where: { id: app.id },
      data: { approvalLetterDate, approvedGrantAmount },
    });

    const splits: { installment: string; pct: number; afterDaysMin: number; afterDaysMax: number }[] = [
      { installment: "FIRST", pct: 0.4, afterDaysMin: 60, afterDaysMax: 100 },
      { installment: "SECOND", pct: 0.35, afterDaysMin: 90, afterDaysMax: 150 },
      { installment: "FINAL", pct: 0.25, afterDaysMin: 90, afterDaysMax: 180 },
    ];

    let cursor = approvalLetterDate;
    for (const split of splits) {
      cursor = addDays(cursor, randInt(split.afterDaysMin, split.afterDaysMax));
      const amount = Math.round(approvedGrantAmount * split.pct);

      let status: string;
      let actualDate: Date | null = null;
      let delayReason: string | null = null;
      let revisedExpectedDate: Date | null = null;

      if (cursor > today) {
        // Future instalment: mostly still planned, a few already flagged "at risk"/delayed.
        if (Math.random() < 0.15) {
          status = "DELAYED";
          delayReason = pick(DELAY_REASONS);
          revisedExpectedDate = addDays(cursor, randInt(20, 60));
        } else {
          status = "PLANNED";
        }
      } else {
        // Past due date: released, or delayed-but-since-rescheduled.
        const roll = Math.random();
        if (roll < 0.72) {
          status = "RELEASED";
          actualDate = addDays(cursor, randInt(-5, 12));
        } else {
          status = "DELAYED";
          delayReason = pick(DELAY_REASONS);
          revisedExpectedDate = addDays(today, randInt(10, 45));
        }
      }

      await prisma.disbursement.create({
        data: {
          applicationId: app.id,
          installment: split.installment,
          plannedDate: cursor,
          actualDate,
          amount,
          status,
          delayReason,
          revisedExpectedDate,
        },
      });
      disbCount++;
    }
  }

  console.log(`Created ${disbCount} disbursement records across ${approvedApps.length} approved applications.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

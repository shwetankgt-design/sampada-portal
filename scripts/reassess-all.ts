import { PrismaClient } from "@prisma/client";
import { assessApplication } from "../src/lib/ruleEngine";

const prisma = new PrismaClient();

async function main() {
  // Auto-computed DOCUMENT-stage scores were created before per-criterion "reason" text
  // existed. Wipe them so assessApplication regenerates each with its reason attached.
  // (assessApplication treats an existing ApplicationScore row as a manual override and
  // will not touch it otherwise, so this is the only way to backfill reasons.)
  const docCriteria = await prisma.scoringCriterion.findMany({
    where: { stage: "DOCUMENT" },
    select: { id: true },
  });
  const del = await prisma.applicationScore.deleteMany({
    where: { criterionId: { in: docCriteria.map((c) => c.id) } },
  });
  console.log(`Cleared ${del.count} document-stage auto-scores for regeneration.`);

  // Backfill a generic reason on presentation-stage scores that predate the remarks field.
  const backfilled = await prisma.applicationScore.updateMany({
    where: { remarks: null, criterion: { stage: "PRESENTATION" } },
    data: { remarks: "Score recorded by the Project Approval Committee based on the quality of the business-model presentation and implementation feasibility shown." },
  });
  console.log(`Backfilled ${backfilled.count} presentation-stage score remarks.`);

  const apps = await prisma.application.findMany({ select: { id: true } });
  console.log(`Re-assessing ${apps.length} applications...`);
  let done = 0;
  for (const a of apps) {
    await assessApplication(a.id);
    done++;
    if (done % 50 === 0) console.log(`  ${done}/${apps.length}`);
  }
  console.log(`Done. Re-assessed ${done} applications.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateSchemeParams, updateCriterionMarks, toggleCriterionActive } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export default async function AdminSchemeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheme = await prisma.scheme.findUnique({
    where: { id },
    include: { criteria: { orderBy: { sortOrder: "asc" } } },
  });
  if (!scheme) notFound();

  const childCodes = new Set(scheme.criteria.filter((c) => c.parentCode).map((c) => c.parentCode));

  return (
    <div>
      <Link href="/admin" className="text-xs text-[var(--gt-purple-700)] hover:underline">
        &larr; All schemes
      </Link>
      <h1 className="gt-page-title mt-1">{scheme.shortName} &mdash; Rule Engine Parameters</h1>
      <p className="gt-page-subtitle mb-6">Code {scheme.code} &middot; Guideline dated {scheme.guidelineDate}</p>

      <form action={updateSchemeParams} className="gt-card mb-6">
        <input type="hidden" name="id" value={scheme.id} />
        <div className="gt-card-title mb-4">Pattern of Assistance &amp; Eligibility Gate</div>
        <div className="grid md:grid-cols-3 gap-4">
          <NumField label="Subsidy % (General Areas)" name="subsidyGeneralPct" defaultValue={scheme.subsidyGeneralPct} />
          <NumField label="Subsidy % (Difficult/SC-ST/FPO)" name="subsidyDifficultPct" defaultValue={scheme.subsidyDifficultPct} />
          <NumField label="Subsidy Cap Amount (₹)" name="subsidyCapAmount" defaultValue={scheme.subsidyCapAmount} />
          <div className="md:col-span-3">
            <label className="gt-label">Subsidy Cap Label</label>
            <input className="gt-input" name="subsidyCapLabel" defaultValue={scheme.subsidyCapLabel || ""} />
          </div>
          <NumField label="Min. Equity % (General)" name="minEquityGeneralPct" defaultValue={scheme.minEquityGeneralPct} />
          <NumField label="Min. Equity % (Difficult/SC-ST/FPO)" name="minEquityDifficultPct" defaultValue={scheme.minEquityDifficultPct} />
          <div />
          <NumField label="Min. Term Loan % (General)" name="minTermLoanGeneralPct" defaultValue={scheme.minTermLoanGeneralPct} />
          <NumField label="Min. Term Loan % (Difficult/SC-ST/FPO)" name="minTermLoanDifficultPct" defaultValue={scheme.minTermLoanDifficultPct} />
          <div />
          <NumField label="Net Worth Multiplier (General)" name="netWorthMultiplierGeneral" defaultValue={scheme.netWorthMultiplierGeneral} step="0.1" />
          <NumField label="Net Worth Multiplier (Difficult/SC-ST/FPO)" name="netWorthMultiplierDifficult" defaultValue={scheme.netWorthMultiplierDifficult} step="0.1" />
          <div />
          <NumField label="Processing Fee - General (₹)" name="processingFeeGeneral" defaultValue={scheme.processingFeeGeneral} />
          <NumField label="Processing Fee - SC/ST (₹)" name="processingFeeScSt" defaultValue={scheme.processingFeeScSt} />
          <NumField label="Performance Security (% of subsidy)" name="performanceSecurityPct" defaultValue={scheme.performanceSecurityPct} />
          <NumField label="Pass Threshold % (General)" name="passThresholdGeneralPct" defaultValue={scheme.passThresholdGeneralPct} />
          <NumField label="Pass Threshold % (SC/ST)" name="passThresholdScStPct" defaultValue={scheme.passThresholdScStPct} />
          <div />
          <NumField label="Cool-off Period (years)" name="coolOffYears" defaultValue={scheme.coolOffYears} />
          <NumField label="Max Projects per 10 years" name="maxProjectsPerDecade" defaultValue={scheme.maxProjectsPerDecade} />
        </div>

        <div className="gt-card-title mb-4 mt-6">Grant Monitoring (Ministry Dashboard)</div>
        <div className="grid md:grid-cols-3 gap-4">
          <NumField label="Budget Allocation, FY (₹)" name="budgetAllocationAmount" defaultValue={scheme.budgetAllocationAmount} />
          <div>
            <label className="gt-label">EOI Release Date</label>
            <input
              className="gt-input"
              type="date"
              name="eoiReleaseDate"
              defaultValue={scheme.eoiReleaseDate ? scheme.eoiReleaseDate.toISOString().slice(0, 10) : ""}
            />
          </div>
          <div>
            <label className="gt-label">EOI Closing Date</label>
            <input
              className="gt-input"
              type="date"
              name="eoiClosingDate"
              defaultValue={scheme.eoiClosingDate ? scheme.eoiClosingDate.toISOString().slice(0, 10) : ""}
            />
          </div>
          <NumField label="Outer Submission Deadline (days after approval letter)" name="outerSubmissionDays" defaultValue={scheme.outerSubmissionDays} />
        </div>
        <button type="submit" className="gt-btn gt-btn-primary mt-5">
          Save Parameters
        </button>
      </form>

      <div className="gt-card">
        <div className="gt-card-title mb-1">Scoring Criteria (100-point rubric)</div>
        <p className="text-xs text-[var(--gt-muted)] mb-3">
          Editing a leaf criterion&apos;s max marks changes the weight of that factor for all
          future assessments. Group header rows (shaded) are shown for context only.
        </p>
        <table className="gt-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Code</th>
              <th>Category / Criterion</th>
              <th style={{ width: 90 }}>Stage</th>
              <th style={{ width: 140 }}>Max Marks</th>
              <th style={{ width: 90 }}>Active</th>
            </tr>
          </thead>
          <tbody>
            {scheme.criteria.map((c) => {
              const isLeaf = !childCodes.has(c.code);
              return (
                <tr key={c.id} style={!isLeaf ? { background: "var(--gt-purple-50)" } : undefined}>
                  <td className="font-mono">{c.code}</td>
                  <td className={!isLeaf ? "font-semibold" : ""}>{c.label}</td>
                  <td>
                    <span className="gt-badge gt-badge-neutral">{c.stage}</span>
                  </td>
                  <td>
                    {isLeaf ? (
                      <form action={updateCriterionMarks} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="schemeId" value={scheme.id} />
                        <input
                          type="number"
                          name="maxMarks"
                          defaultValue={c.maxMarks}
                          step="0.5"
                          min={0}
                          className="gt-input !w-20 !py-1"
                        />
                        <button type="submit" className="gt-btn gt-btn-secondary !py-1 !px-2 text-xs">
                          Save
                        </button>
                      </form>
                    ) : (
                      c.maxMarks
                    )}
                  </td>
                  <td>
                    {isLeaf ? (
                      <form action={toggleCriterionActive}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="schemeId" value={scheme.id} />
                        <input type="hidden" name="isActive" value={String(c.isActive)} />
                        <button
                          type="submit"
                          className={`gt-badge ${c.isActive ? "gt-badge-success" : "gt-badge-neutral"}`}
                        >
                          {c.isActive ? "Active" : "Disabled"}
                        </button>
                      </form>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NumField({
  label,
  name,
  defaultValue,
  step,
}: {
  label: string;
  name: string;
  defaultValue: number;
  step?: string;
}) {
  return (
    <div>
      <label className="gt-label">{label}</label>
      <input className="gt-input" type="number" name={name} defaultValue={defaultValue} step={step || "1"} />
    </div>
  );
}

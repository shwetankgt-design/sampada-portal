import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createApplication } from "@/lib/actions/applications";

export const dynamic = "force-dynamic";

export default async function NewApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ schemeId?: string }>;
}) {
  const { schemeId } = await searchParams;
  const schemes = await prisma.scheme.findMany({ orderBy: { code: "asc" } });

  if (!schemeId) {
    return (
      <div className="max-w-xl">
        <h1 className="gt-page-title">Intake New Application</h1>
        <p className="gt-page-subtitle mb-6">
          Select the scheme this application was received against on the SAMPADA portal.
        </p>
        <form action="/applications/new" className="gt-card space-y-4">
          <div>
            <label className="gt-label">Scheme</label>
            <select name="schemeId" className="gt-select" required>
              <option value="">Select a scheme&hellip;</option>
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shortName}
                </option>
              ))}
            </select>
          </div>
          <button className="gt-btn gt-btn-primary" type="submit">
            Continue
          </button>
        </form>
      </div>
    );
  }

  const scheme = await prisma.scheme.findUnique({
    where: { id: schemeId },
    include: { criteria: { orderBy: { sortOrder: "asc" } } },
  });
  if (!scheme) {
    return <p>Scheme not found.</p>;
  }

  const childCodes = new Set(scheme.criteria.filter((c) => c.parentCode).map((c) => c.parentCode));
  const booleanLeafCriteria = scheme.criteria.filter(
    (c) => c.stage === "DOCUMENT" && c.inputType === "BOOLEAN" && !childCodes.has(c.code)
  );

  return (
    <div className="max-w-3xl">
      <Link href="/applications/new" className="text-xs text-[var(--gt-purple-700)] hover:underline">
        &larr; Change scheme
      </Link>
      <h1 className="gt-page-title mt-1">New Application &mdash; {scheme.shortName}</h1>
      <p className="gt-page-subtitle mb-6">
        Enter the applicant, project and appraisal details exactly as received/verified from the
        DPR, bank appraisal note and supporting documents. The rule engine will run automatically
        on submission.
      </p>

      <form action={createApplication} className="space-y-6">
        <input type="hidden" name="schemeId" value={scheme.id} />

        <Section title="Applicant Details">
          <Field label="Applicant / Entity Name" name="applicantName" required />
          <Field label="Entity Type" name="entityType" placeholder="Pvt. Ltd. Co. / Society / FPO / Partnership etc." required />
          <div>
            <label className="gt-label">Applicant Category</label>
            <select name="category" className="gt-select">
              <option value="GENERAL">General</option>
              <option value="SC_ST">SC/ST</option>
              <option value="WOMEN">Women-led</option>
              <option value="FPO">FPO / SHG</option>
            </select>
          </div>
          <Field label="State" name="state" required />
          <Field label="District" name="district" required />
          <div className="flex items-center gap-2 pt-6">
            <input type="checkbox" name="isDifficultArea" id="isDifficultArea" className="w-4 h-4" />
            <label htmlFor="isDifficultArea" className="text-sm text-[var(--gt-ink)]">
              Difficult Area (NE States / Uttarakhand / HP / J&amp;K / Ladakh / ITDP / A&amp;N / Lakshadweep)
            </label>
          </div>
        </Section>

        <Section title="Project Cost & Appraisal">
          <Field label="Total Project Cost (₹)" name="totalProjectCost" type="number" required />
          <Field label="Eligible Project Cost (₹)" name="eligibleProjectCost" type="number" required />
          <Field label="Subsidy Sought (₹)" name="subsidySought" type="number" required />
          <Field label="Promoter's Equity (% of TPC)" name="equityPct" type="number" step="0.1" />
          <Field label="Term Loan Sanctioned (% of TPC)" name="termLoanPct" type="number" step="0.1" />
          <Field label="Combined Net Worth of Applicant (₹)" name="netWorth" type="number" />
          <Field label="Project IRR (%)" name="irrPct" type="number" step="0.1" />
          <Field label="Average DSCR" name="avgDscr" type="number" step="0.01" />
        </Section>

        <Section title="Eligibility Gate Declarations">
          <Checkbox label="Detailed Appraisal Note from Scheduled Commercial Bank/NABARD/SIDBI/NEDFi submitted" name="hasDetailedAppraisalNote" />
          <Checkbox label="Certificate of incorporation/registration, PAN, GSTIN/MSME Udyam & by-laws submitted" name="hasStatutoryDocs" />
          <Checkbox label="Entity is insolvent / in receivership / under legal proceedings" name="isInsolvent" />
          <div>
            <label className="gt-label">Cool-off period since last MoFPI assistance satisfied?</label>
            <select name="coolOffSatisfied" className="gt-select" defaultValue="true">
              <option value="true">Yes / First-time applicant</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label className="gt-label">Within max. 2 projects per 10 years under any PMKSY sub-scheme?</label>
            <select name="maxProjectsSatisfied" className="gt-select" defaultValue="true">
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <Checkbox label="SC/ST member(s) hold at least 51% stake in the entity" name="isScSt" />
          <Field label="SC/ST share of combined net worth (%) — if applicable" name="scstNetWorthSharePct" type="number" step="0.1" />
        </Section>

        <Section title="Document-Stage Scoring Declarations">
          <div className="md:col-span-2 space-y-2">
            {booleanLeafCriteria.map((c) => (
              <Checkbox
                key={c.id}
                label={`[${c.code}, ${c.maxMarks} marks] ${c.label}`}
                name={`crit_${c.code.replace(/\./g, "_")}`}
              />
            ))}
          </div>
        </Section>

        <button type="submit" className="gt-btn gt-btn-primary">
          Submit &amp; Run Assessment
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="gt-card">
      <div className="gt-card-title mb-4">{title}</div>
      <div className="grid md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  step,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  step?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="gt-label">{label}</label>
      <input
        className="gt-input"
        type={type}
        name={name}
        required={required}
        step={step}
        placeholder={placeholder}
      />
    </div>
  );
}

function Checkbox({ label, name }: { label: string; name: string }) {
  return (
    <label className="flex items-start gap-2 text-sm text-[var(--gt-ink)]">
      <input type="checkbox" name={name} className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{label}</span>
    </label>
  );
}

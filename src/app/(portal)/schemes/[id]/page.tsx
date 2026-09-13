import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SchemeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [scheme, user] = await Promise.all([
    prisma.scheme.findUnique({
      where: { id },
      include: { criteria: { orderBy: { sortOrder: "asc" } } },
    }),
    getCurrentUser(),
  ]);
  if (!scheme) notFound();

  const documentCriteria = scheme.criteria.filter((c) => c.stage === "DOCUMENT");
  const presentationCriteria = scheme.criteria.filter((c) => c.stage === "PRESENTATION");
  const childCodes = new Set(scheme.criteria.filter((c) => c.parentCode).map((c) => c.parentCode));

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <Link href="/schemes" className="text-xs text-[var(--gt-purple-700)] hover:underline">
            &larr; All schemes
          </Link>
          <h1 className="gt-page-title mt-1">{scheme.name}</h1>
          <p className="gt-page-subtitle">
            Guideline dated {scheme.guidelineDate} &middot; Code {scheme.code}
          </p>
        </div>
        {user?.role === "ADMIN" && (
          <Link href={`/admin/schemes/${scheme.id}`} className="gt-btn gt-btn-primary">
            Edit Rule Engine Parameters
          </Link>
        )}
      </div>

      <p className="text-sm text-[var(--gt-ink)] leading-relaxed mb-6">{scheme.description}</p>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Param label="Subsidy - General Areas" value={`${scheme.subsidyGeneralPct}%`} />
        <Param label="Subsidy - Difficult/SC-ST/FPO" value={`${scheme.subsidyDifficultPct}%`} />
        <Param label="Subsidy Cap" value={scheme.subsidyCapLabel || formatINR(scheme.subsidyCapAmount)} />
        <Param label="Performance Security" value={`${scheme.performanceSecurityPct}% of subsidy`} />
        <Param label="Min. Equity (General)" value={`${scheme.minEquityGeneralPct}%`} />
        <Param label="Min. Equity (Difficult/SC-ST/FPO)" value={`${scheme.minEquityDifficultPct}%`} />
        <Param label="Min. Term Loan (General)" value={`${scheme.minTermLoanGeneralPct}%`} />
        <Param label="Min. Term Loan (Difficult/SC-ST/FPO)" value={`${scheme.minTermLoanDifficultPct}%`} />
        <Param label="Net Worth Multiplier (General)" value={`${scheme.netWorthMultiplierGeneral}x subsidy`} />
        <Param label="Net Worth Multiplier (Difficult/SC-ST/FPO)" value={`${scheme.netWorthMultiplierDifficult}x subsidy`} />
        <Param label="Pass Threshold (General)" value={`${scheme.passThresholdGeneralPct}%`} />
        <Param label="Pass Threshold (SC/ST)" value={`${scheme.passThresholdScStPct}%`} />
      </div>

      <div className="gt-card mb-6">
        <div className="gt-card-title mb-3">
          Document-Stage Scoring Criteria &mdash; max {documentCriteria.reduce((s, c) => (childCodes.has(c.code) ? s : s + c.maxMarks), 0)} marks
        </div>
        <table className="gt-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Code</th>
              <th>Category / Criterion</th>
              <th style={{ width: 90 }}>Max Marks</th>
              <th style={{ width: 100 }}>Type</th>
            </tr>
          </thead>
          <tbody>
            {documentCriteria.map((c) => {
              const isLeaf = !childCodes.has(c.code);
              return (
                <tr key={c.id} style={!isLeaf ? { background: "var(--gt-purple-50)" } : undefined}>
                  <td className="font-mono">{c.code}</td>
                  <td className={!isLeaf ? "font-semibold" : ""}>
                    {!c.parentCode ? c.category : null}
                    {!c.parentCode && <br />}
                    <span className={!isLeaf ? "" : "text-[var(--gt-muted)]"}>{c.label}</span>
                  </td>
                  <td>{c.maxMarks}</td>
                  <td>
                    {isLeaf ? <span className="gt-badge gt-badge-neutral">{c.inputType}</span> : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="gt-card">
        <div className="gt-card-title mb-3">
          Presentation-Stage Scoring &mdash; max {presentationCriteria.reduce((s, c) => (childCodes.has(c.code) ? s : s + c.maxMarks), 0)} marks
        </div>
        <table className="gt-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Code</th>
              <th>Criterion</th>
              <th style={{ width: 90 }}>Max Marks</th>
            </tr>
          </thead>
          <tbody>
            {presentationCriteria.map((c) => (
              <tr key={c.id}>
                <td className="font-mono">{c.code}</td>
                <td>{c.label}</td>
                <td>{c.maxMarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div className="gt-card !p-3">
      <div className="text-sm font-bold text-[var(--gt-purple-800)]">{value}</div>
      <div className="text-[0.68rem] text-[var(--gt-muted)] font-semibold uppercase tracking-wide mt-0.5">
        {label}
      </div>
    </div>
  );
}

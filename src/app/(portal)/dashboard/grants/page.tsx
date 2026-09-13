import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/format";
import { MonthlyDisbursementChart } from "./_charts";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

const INSTALMENT_LABEL: Record<string, string> = { FIRST: "1st Instalment", SECOND: "2nd Instalment", FINAL: "Final Disbursement" };

export default async function GrantMonitoringDashboard({
  searchParams,
}: {
  searchParams: Promise<{ schemeId?: string }>;
}) {
  const { schemeId } = await searchParams;
  const schemes = await prisma.scheme.findMany({ orderBy: { code: "asc" } });
  const defaultScheme = schemes.find((s) => s.code === "FTL") ?? schemes[0];
  const scheme = (schemeId ? schemes.find((s) => s.id === schemeId) : undefined) ?? defaultScheme;

  const applications = await prisma.application.findMany({
    where: { schemeId: scheme.id },
    include: { recommendation: true, disbursements: { orderBy: { plannedDate: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  const receivedCount = applications.filter((a) => a.status !== "DRAFT").length;
  const eligibleCount = applications.filter((a) => a.recommendation?.eligibilityPassed).length;
  const approvedApps = applications.filter((a) => a.status === "APPROVED");
  const totalApprovedGrant = approvedApps.reduce((sum, a) => sum + (a.approvedGrantAmount || 0), 0);
  const budgetUtilizationPct = scheme.budgetAllocationAmount > 0 ? (totalApprovedGrant / scheme.budgetAllocationAmount) * 100 : 0;

  const today = new Date();
  const eoiStatus = !scheme.eoiClosingDate
    ? "Not scheduled"
    : today < scheme.eoiClosingDate
      ? `Open · closes in ${daysBetween(scheme.eoiClosingDate, today)} days`
      : `Closed ${daysBetween(today, scheme.eoiClosingDate)} days ago`;

  // ---- Month-wise disbursement calendar (portfolio-wide: total + scheme-wise breakup) ----
  const allDisbursements = await prisma.disbursement.findMany({
    include: { application: { include: { scheme: true } } },
  });
  const monthKey = (d: Date) => `${d.toLocaleString("en-IN", { month: "short" })} ${d.getFullYear()}`;
  const monthOrder: string[] = [];
  const monthBuckets = new Map<string, Record<string, number>>();
  for (let i = -3; i <= 8; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const key = monthKey(d);
    monthOrder.push(key);
    monthBuckets.set(key, {});
  }
  for (const d of allDisbursements) {
    const key = monthKey(d.plannedDate);
    if (!monthBuckets.has(key)) continue;
    const bucket = monthBuckets.get(key)!;
    const code = d.application.scheme.code;
    bucket[code] = (bucket[code] || 0) + d.amount;
  }
  const schemeKeys = schemes.map((s) => ({ key: s.code, label: s.shortName }));
  const monthChartData = monthOrder.map((month) => {
    const bucket = monthBuckets.get(month) || {};
    const row: Record<string, number | string> = { month };
    let total = 0;
    for (const s of schemeKeys) {
      const cr = Math.round(((bucket[s.key] || 0) / 1_00_00_000) * 100) / 100;
      row[s.key] = cr;
      total += cr;
    }
    row.total = Math.round(total * 100) / 100;
    return row;
  });

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="gt-page-title">Grant Monitoring Dashboard</h1>
          <p className="gt-page-subtitle">
            Senior Ministry review &mdash; scheme-wise grant tracking under PMKSY. Illustration: {scheme.shortName}.
          </p>
        </div>
        <Link href="/dashboard" className="gt-btn gt-btn-ghost">
          &larr; Executive Dashboard
        </Link>
      </div>

      <form method="get" className="gt-card mb-6 flex items-end gap-3">
        <div className="min-w-[260px]">
          <label className="gt-label">Scheme</label>
          <select name="schemeId" defaultValue={scheme.id} className="gt-select">
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shortName}
              </option>
            ))}
          </select>
        </div>
        <button className="gt-btn gt-btn-secondary" type="submit">
          View Scheme
        </button>
      </form>

      {/* 1 & 2: Budget allocation, EOI cycle */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Kpi label="Budget Allocation (FY)" value={formatINR(scheme.budgetAllocationAmount)} />
        <Kpi label="EOI Release Date" value={fmtDate(scheme.eoiReleaseDate)} />
        <Kpi label="EOI Closing Date" value={fmtDate(scheme.eoiClosingDate)} />
        <Kpi label="EOI Status" value={eoiStatus} />
      </div>

      {/* 3 & 4: applications received / eligible */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Kpi label="Applications Received" value={receivedCount.toString()} />
        <Kpi
          label="Eligible Applications"
          value={`${eligibleCount} (${receivedCount > 0 ? Math.round((eligibleCount / receivedCount) * 100) : 0}%)`}
          tone="success"
        />
        <Kpi label="Approved for Assistance" value={approvedApps.length.toString()} tone="success" />
        <Kpi
          label="Budget Utilized"
          value={`${formatINR(totalApprovedGrant)} (${budgetUtilizationPct.toFixed(1)}%)`}
          tone={budgetUtilizationPct > 90 ? "danger" : budgetUtilizationPct > 70 ? "warning" : undefined}
        />
      </div>

      {/* 5 & 6: Approval timeline + applicant details */}
      <div className="gt-card mb-6">
        <div className="gt-card-title mb-1">Approved Applicants &mdash; Approval Timeline &amp; Project Details</div>
        <p className="text-xs text-[var(--gt-muted)] mb-3">
          Outer submission deadline = Approval Letter Date + {scheme.outerSubmissionDays} days allowed for the PIA to
          submit acceptance/BG documents on the portal.
        </p>
        {approvedApps.length === 0 ? (
          <p className="text-xs text-[var(--gt-muted)]">No applications approved yet under this scheme.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="gt-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Location</th>
                  <th>Business Type</th>
                  <th>Total Project Cost</th>
                  <th>Eligible Project Cost</th>
                  <th>Approved Grant</th>
                  <th>Approval Letter Date</th>
                  <th>Outer Submission Deadline</th>
                </tr>
              </thead>
              <tbody>
                {approvedApps.map((a) => {
                  const deadline = a.approvalLetterDate
                    ? new Date(a.approvalLetterDate.getTime() + scheme.outerSubmissionDays * 24 * 60 * 60 * 1000)
                    : null;
                  const overdue = deadline ? today > deadline : false;
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/applications/${a.id}`} className="text-[var(--gt-purple-700)] font-medium hover:underline">
                          {a.applicantName}
                        </Link>
                      </td>
                      <td className="text-xs">
                        {a.district}, {a.state}
                      </td>
                      <td className="text-xs">{a.entityType}</td>
                      <td>{a.totalProjectCost ? formatINR(a.totalProjectCost) : "—"}</td>
                      <td>{a.eligibleProjectCost ? formatINR(a.eligibleProjectCost) : "—"}</td>
                      <td className="font-semibold text-[var(--gt-purple-800)]">
                        {a.approvedGrantAmount ? formatINR(a.approvedGrantAmount) : "—"}
                      </td>
                      <td className="text-xs">{fmtDate(a.approvalLetterDate)}</td>
                      <td className="text-xs">
                        {fmtDate(deadline)}{" "}
                        {deadline && (
                          <span className={`gt-badge ${overdue ? "gt-badge-danger" : "gt-badge-success"} ml-1`}>
                            {overdue ? "Passed" : "On Track"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 7 & 8: Disbursement tracker */}
      <div className="gt-card mb-6">
        <div className="gt-card-title mb-1">Real-Time Grant Disbursement Tracker</div>
        <p className="text-xs text-[var(--gt-muted)] mb-3">
          1st / 2nd instalment and final disbursement, with reason and revised expected date captured for any delay.
        </p>
        {approvedApps.length === 0 ? (
          <p className="text-xs text-[var(--gt-muted)]">No disbursements scheduled yet under this scheme.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="gt-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>1st Instalment</th>
                  <th>2nd Instalment</th>
                  <th>Final Disbursement</th>
                </tr>
              </thead>
              <tbody>
                {approvedApps.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/applications/${a.id}`} className="text-[var(--gt-purple-700)] font-medium hover:underline">
                        {a.applicantName}
                      </Link>
                    </td>
                    {["FIRST", "SECOND", "FINAL"].map((inst) => {
                      const d = a.disbursements.find((x) => x.installment === inst);
                      return (
                        <td key={inst} style={{ minWidth: 190 }}>
                          {d ? <DisbursementCell d={d} /> : <span className="text-xs text-[var(--gt-muted)]">Not scheduled</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 9: Month-wise disbursement calendar, total + scheme-wise breakup */}
      <div className="gt-card">
        <div className="gt-card-title mb-1">Month-wise Potential Disbursement Calendar</div>
        <p className="text-xs text-[var(--gt-muted)] mb-3">
          Portfolio-wide across all 7 schemes (₹ Crore) &mdash; last 3 months and next 8 months, by planned
          disbursement date.
        </p>
        <MonthlyDisbursementChart data={monthChartData} schemeKeys={schemeKeys} />
        <div className="overflow-x-auto mt-4">
          <table className="gt-table">
            <thead>
              <tr>
                <th>Month</th>
                {schemeKeys.map((s) => (
                  <th key={s.key}>{s.label}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {monthChartData.map((row) => (
                <tr key={row.month as string}>
                  <td className="font-medium">{row.month}</td>
                  {schemeKeys.map((s) => (
                    <td key={s.key}>₹{row[s.key]} Cr</td>
                  ))}
                  <td className="font-semibold text-[var(--gt-purple-800)]">₹{row.total} Cr</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DisbursementCell({
  d,
}: {
  d: { status: string; plannedDate: Date; actualDate: Date | null; amount: number; delayReason: string | null; revisedExpectedDate: Date | null };
}) {
  const badgeCls = d.status === "RELEASED" ? "gt-badge-success" : d.status === "DELAYED" ? "gt-badge-danger" : "gt-badge-neutral";
  return (
    <div className="text-xs leading-snug">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`gt-badge ${badgeCls}`}>{d.status}</span>
        <span className="font-semibold text-[var(--gt-ink)]">{formatINR(d.amount)}</span>
      </div>
      <div className="text-[var(--gt-muted)]">
        {d.status === "RELEASED"
          ? `Released ${fmtDate(d.actualDate)}`
          : `Planned ${fmtDate(d.plannedDate)}`}
      </div>
      {d.status === "DELAYED" && (
        <div className="mt-1 text-[var(--gt-danger)]">
          {d.delayReason}
          <br />
          Revised ETA: {fmtDate(d.revisedExpectedDate)}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" | "warning" }) {
  const color =
    tone === "success" ? "var(--gt-success)" : tone === "danger" ? "var(--gt-danger)" : tone === "warning" ? "var(--gt-warning)" : undefined;
  return (
    <div className="gt-card">
      <div className="text-lg font-extrabold" style={{ color: color || "var(--gt-purple-800)" }}>
        {value}
      </div>
      <div className="gt-kpi-label">{label}</div>
    </div>
  );
}

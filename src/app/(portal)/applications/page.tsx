import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge, VerdictBadge } from "../_components/StatusBadge";
import { formatINR } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ schemeId?: string; status?: string }>;
}) {
  const { schemeId, status } = await searchParams;
  const [applications, schemes] = await Promise.all([
    prisma.application.findMany({
      where: {
        schemeId: schemeId || undefined,
        status: status || undefined,
      },
      include: { scheme: true, recommendation: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.scheme.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="gt-page-title">Applications</h1>
          <p className="gt-page-subtitle">{applications.length} application(s)</p>
        </div>
        <Link href="/applications/new" className="gt-btn gt-btn-primary">
          + Intake New Application
        </Link>
      </div>

      <form className="gt-card mb-4 flex items-end gap-3" method="get">
        <div>
          <label className="gt-label">Scheme</label>
          <select name="schemeId" defaultValue={schemeId || ""} className="gt-select">
            <option value="">All schemes</option>
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shortName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="gt-label">Status</label>
          <select name="status" defaultValue={status || ""} className="gt-select">
            <option value="">All statuses</option>
            {[
              "SUBMITTED",
              "INELIGIBLE",
              "ELIGIBLE_PENDING_SCORE",
              "SCORED",
              "SHORTLISTED_FOR_PRESENTATION",
              "PRESENTED",
              "APPROVED",
              "REJECTED",
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button className="gt-btn gt-btn-secondary" type="submit">
          Filter
        </button>
      </form>

      <div className="gt-card !p-0 overflow-hidden">
        <table className="gt-table">
          <thead>
            <tr>
              <th>Application No.</th>
              <th>Applicant</th>
              <th>Scheme</th>
              <th>Subsidy Sought</th>
              <th>Status</th>
              <th>Score</th>
              <th>Recommendation</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => (
              <tr key={a.id}>
                <td className="font-mono text-xs">{a.applicationNo}</td>
                <td>{a.applicantName}</td>
                <td>{a.scheme.shortName}</td>
                <td>{a.subsidySought ? formatINR(a.subsidySought) : "—"}</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td>{a.recommendation ? `${a.recommendation.percentageScore.toFixed(1)}%` : "—"}</td>
                <td>{a.recommendation ? <VerdictBadge verdict={a.recommendation.verdict} /> : "—"}</td>
                <td>
                  <Link href={`/applications/${a.id}`} className="text-xs font-semibold text-[var(--gt-purple-700)] hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-sm text-[var(--gt-muted)] py-8">
                  No applications match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

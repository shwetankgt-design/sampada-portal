import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { StatusFunnel, DonutChart, VerticalBarChart, HorizontalBarChart, TrendLineChart } from "./_charts";
import { formatINR } from "@/lib/format";
import { StatusBadge, VerdictBadge } from "../_components/StatusBadge";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_SCRUTINY: "Under Scrutiny",
  INELIGIBLE: "Ineligible",
  ELIGIBLE_PENDING_SCORE: "Pending Score",
  SCORED: "Scored (Below Threshold)",
  SHORTLISTED_FOR_PRESENTATION: "Shortlisted",
  PRESENTED: "Presented",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "General",
  SC_ST: "SC/ST",
  WOMEN: "Women-led",
  FPO: "FPO/SHG",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ schemeId?: string }>;
}) {
  const { schemeId } = await searchParams;

  const [schemes, applications] = await Promise.all([
    prisma.scheme.findMany({ orderBy: { code: "asc" } }),
    prisma.application.findMany({
      where: schemeId ? { schemeId } : undefined,
      include: { scheme: true, recommendation: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const selectedScheme = schemeId ? schemes.find((s) => s.id === schemeId) : undefined;

  const totalApplications = applications.length;
  const statusCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  for (const a of applications) {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
    categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
  }

  const recommendations = applications.map((a) => a.recommendation).filter((r): r is NonNullable<typeof r> => !!r);
  const recommended = recommendations.filter((r) => r.verdict === "RECOMMENDED").length;
  const notRecommended = recommendations.filter((r) => r.verdict === "NOT_RECOMMENDED").length;
  const needsReview = recommendations.filter((r) => r.verdict === "NEEDS_REVIEW").length;
  const ineligible = applications.filter((a) => a.status === "INELIGIBLE").length;

  const totalSubsidySought = applications.reduce((sum, a) => sum + (a.subsidySought || 0), 0);
  const totalSubsidyRecommended = applications
    .filter((a) => a.recommendation?.verdict === "RECOMMENDED")
    .reduce((sum, a) => sum + (a.subsidySought || 0), 0);

  const funnelData = [
    { stage: "Submitted", count: applications.filter((a) => a.status !== "DRAFT").length },
    {
      stage: "Eligible",
      count: applications.filter((a) =>
        ["ELIGIBLE_PENDING_SCORE", "SCORED", "SHORTLISTED_FOR_PRESENTATION", "PRESENTED", "APPROVED"].includes(
          a.status
        )
      ).length,
    },
    {
      stage: "Shortlisted",
      count: applications.filter((a) =>
        ["SHORTLISTED_FOR_PRESENTATION", "PRESENTED", "APPROVED"].includes(a.status)
      ).length,
    },
    { stage: "Approved", count: applications.filter((a) => a.status === "APPROVED").length },
  ];

  const statusDonutData = Object.entries(statusCounts).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
  }));

  const verdictDonutData = [
    { name: "Recommended", value: recommended },
    { name: "Not Recommended", value: notRecommended },
    { name: "Needs Review", value: needsReview },
  ];

  const categoryBarData = ["GENERAL", "SC_ST", "WOMEN", "FPO"].map((cat) => ({
    name: CATEGORY_LABELS[cat],
    value: categoryCounts[cat] || 0,
  }));

  const scoreBuckets = [
    { label: "0-20%", min: 0, max: 20 },
    { label: "20-40%", min: 20, max: 40 },
    { label: "40-60%", min: 40, max: 60 },
    { label: "60-80%", min: 60, max: 80 },
    { label: "80-100%", min: 80, max: 100.01 },
  ];
  const scoreHistogramData = scoreBuckets.map((b) => ({
    name: b.label,
    value: recommendations.filter((r) => r.percentageScore >= b.min && r.percentageScore < b.max).length,
  }));

  const stateCounts: Record<string, number> = {};
  for (const a of applications) stateCounts[a.state] = (stateCounts[a.state] || 0) + 1;
  const topStatesData = Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  const monthKey = (d: Date) => `${d.toLocaleString("en-IN", { month: "short" })} ${d.getFullYear()}`;
  const monthBuckets = new Map<string, number>();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.set(monthKey(d), 0);
  }
  for (const a of applications) {
    const key = monthKey(a.createdAt);
    if (monthBuckets.has(key)) monthBuckets.set(key, (monthBuckets.get(key) || 0) + 1);
  }
  const trendData = Array.from(monthBuckets.entries()).map(([month, count]) => ({ month, count }));

  const schemeRows = schemes.map((s) => {
    const apps = applications.filter((a) => a.schemeId === s.id);
    const rec = apps.filter((a) => a.recommendation?.verdict === "RECOMMENDED").length;
    return {
      id: s.id,
      name: s.shortName,
      count: apps.length,
      recommended: rec,
      avgScore:
        apps.filter((a) => a.recommendation).length > 0
          ? Math.round(
              (apps.reduce((sum, a) => sum + (a.recommendation?.percentageScore || 0), 0) /
                apps.filter((a) => a.recommendation).length) *
                10
            ) / 10
          : null,
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="gt-page-title">Executive Dashboard</h1>
          <p className="gt-page-subtitle">
            {selectedScheme
              ? `Filtered to ${selectedScheme.shortName} — live from the assessment rule engine`
              : "Portfolio-wide status across all 7 PMKSY schemes — live from the assessment rule engine"}
          </p>
        </div>
        <Link href="/applications/new" className="gt-btn gt-btn-primary">
          + Intake New Application
        </Link>
      </div>

      <form method="get" className="gt-card mb-6 flex items-end gap-3">
        <div className="min-w-[240px]">
          <label className="gt-label">Filter all charts by scheme</label>
          <select name="schemeId" defaultValue={schemeId || ""} className="gt-select">
            <option value="">All 7 schemes (portfolio view)</option>
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shortName}
              </option>
            ))}
          </select>
        </div>
        <button className="gt-btn gt-btn-secondary" type="submit">
          Apply Filter
        </button>
        {schemeId && (
          <Link href="/dashboard" className="gt-btn gt-btn-ghost">
            Clear Filter
          </Link>
        )}
      </form>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi label="Total Applications" value={totalApplications.toString()} />
        <Kpi label="Recommended" value={recommended.toString()} tone="success" />
        <Kpi label="Not Recommended / Ineligible" value={(notRecommended + ineligible).toString()} tone="danger" />
        <Kpi label="Pending Review" value={needsReview.toString()} tone="warning" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Kpi label="Total Subsidy Sought" value={formatINR(totalSubsidySought)} />
        <Kpi label="Subsidy Recommended (Approved-Eligible)" value={formatINR(totalSubsidyRecommended)} tone="success" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="gt-card">
          <div className="gt-card-title mb-3">Application Funnel</div>
          <StatusFunnel data={funnelData} />
        </div>
        <div className="gt-card">
          <div className="gt-card-title mb-3">Status Distribution</div>
          <DonutChart data={statusDonutData} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="gt-card">
          <div className="gt-card-title mb-3">Recommendation Verdict</div>
          <DonutChart data={verdictDonutData} />
        </div>
        <div className="gt-card">
          <div className="gt-card-title mb-3">Score Distribution</div>
          <VerticalBarChart data={scoreHistogramData} color="#5c2c8f" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="gt-card">
          <div className="gt-card-title mb-3">Applicant Category Mix</div>
          <VerticalBarChart data={categoryBarData} color="#f2760a" />
        </div>
        <div className="gt-card">
          <div className="gt-card-title mb-3">Top States by Application Volume</div>
          <HorizontalBarChart data={topStatesData} />
        </div>
      </div>

      <div className="gt-card mb-6">
        <div className="gt-card-title mb-3">Applications Received — Last 12 Months</div>
        <TrendLineChart data={trendData} />
      </div>

      {!selectedScheme && (
        <div className="gt-card mb-6">
          <div className="gt-card-title mb-3">Scheme-wise Performance</div>
          <table className="gt-table">
            <thead>
              <tr>
                <th>Scheme</th>
                <th>Applications</th>
                <th>Recommended</th>
                <th>Avg. Score</th>
              </tr>
            </thead>
            <tbody>
              {schemeRows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/dashboard?schemeId=${r.id}`} className="text-[var(--gt-purple-700)] font-medium hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td>{r.count}</td>
                  <td>{r.recommended}</td>
                  <td>{r.avgScore !== null ? `${r.avgScore}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="gt-card">
        <div className="flex items-center justify-between mb-3">
          <div className="gt-card-title">Recent Applications</div>
          <Link
            href={selectedScheme ? `/applications?schemeId=${selectedScheme.id}` : "/applications"}
            className="text-xs font-semibold text-[var(--gt-purple-700)] hover:underline"
          >
            View all &rarr;
          </Link>
        </div>
        {applications.length === 0 ? (
          <EmptyState />
        ) : (
          <table className="gt-table">
            <thead>
              <tr>
                <th>Application No.</th>
                <th>Applicant</th>
                <th>Scheme</th>
                <th>Status</th>
                <th>Score</th>
                <th>Recommendation</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {applications.slice(0, 8).map((a) => (
                <tr key={a.id}>
                  <td className="font-mono text-xs">{a.applicationNo}</td>
                  <td>{a.applicantName}</td>
                  <td>{a.scheme.shortName}</td>
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
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" | "warning" }) {
  const color =
    tone === "success" ? "var(--gt-success)" : tone === "danger" ? "var(--gt-danger)" : tone === "warning" ? "var(--gt-warning)" : undefined;
  return (
    <div className="gt-card">
      <div className="gt-kpi-value" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="gt-kpi-label">{label}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-10">
      <p className="text-sm text-[var(--gt-muted)] mb-3">
        No applications match this filter yet.
      </p>
      <Link href="/applications/new" className="gt-btn gt-btn-primary">
        + Intake New Application
      </Link>
    </div>
  );
}

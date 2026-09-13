import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const schemes = await prisma.scheme.findMany({ orderBy: { code: "asc" } });
  return (
    <div>
      <h1 className="gt-page-title">Rule Engine Configuration</h1>
      <p className="gt-page-subtitle mb-6">
        Select a scheme to edit its subsidy rates, eligibility gate thresholds and scoring
        criterion weights. Changes apply immediately to future assessments; existing
        applications can be re-scored using &ldquo;Recompute Recommendation&rdquo;.
      </p>
      <div className="gt-card !p-0 overflow-hidden">
        <table className="gt-table">
          <thead>
            <tr>
              <th>Scheme</th>
              <th>Subsidy (Gen/Diff)</th>
              <th>Pass Threshold (Gen/SC-ST)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {schemes.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.shortName}</td>
                <td>
                  {s.subsidyGeneralPct}% / {s.subsidyDifficultPct}%
                </td>
                <td>
                  {s.passThresholdGeneralPct}% / {s.passThresholdScStPct}%
                </td>
                <td>
                  <Link href={`/admin/schemes/${s.id}`} className="text-xs font-semibold text-[var(--gt-purple-700)] hover:underline">
                    Configure &rarr;
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

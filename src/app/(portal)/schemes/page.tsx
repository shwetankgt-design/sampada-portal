import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SchemesPage() {
  const schemes = await prisma.scheme.findMany({
    include: { _count: { select: { applications: true, criteria: true } } },
    orderBy: { code: "asc" },
  });

  return (
    <div>
      <h1 className="gt-page-title">The 7 PMKSY / SAMPADA Schemes</h1>
      <p className="gt-page-subtitle mb-6">
        Each scheme carries its own eligibility gate and 100-point scoring rubric, sourced
        from its scheme guideline and configurable by an administrator.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {schemes.map((s) => (
          <Link key={s.id} href={`/schemes/${s.id}`} className="gt-card hover:border-[var(--gt-purple-500)] transition block">
            <div className="flex items-start justify-between mb-2">
              <div className="gt-card-title">{s.shortName}</div>
              <span className="gt-badge gt-badge-neutral">{s.code}</span>
            </div>
            <p className="text-xs text-[var(--gt-muted)] leading-relaxed mb-3 line-clamp-3">
              {s.description}
            </p>
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="font-bold text-[var(--gt-purple-800)]">
                  {s.subsidyGeneralPct}% / {s.subsidyDifficultPct}%
                </span>{" "}
                <span className="text-[var(--gt-muted)]">subsidy (general/difficult)</span>
              </div>
              <div>
                <span className="font-bold text-[var(--gt-purple-800)]">{formatINR(s.subsidyCapAmount)}</span>{" "}
                <span className="text-[var(--gt-muted)]">cap</span>
              </div>
            </div>
            <div className="gt-divider !my-3" />
            <div className="flex items-center justify-between text-xs text-[var(--gt-muted)]">
              <span>{s._count.criteria} scoring criteria configured</span>
              <span>{s._count.applications} applications</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

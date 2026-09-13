import { prisma } from "@/lib/prisma";
import { loginAsUser } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/session";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: "Configure schemes, eligibility parameters and the scoring rule engine.",
  OFFICER: "Intake applications, verify documents and enter assessment data.",
  APPROVER: "Score presentations and finalise the merit-list recommendation.",
  EXECUTIVE: "View portfolio KPIs, funnel and scheme-wise performance dashboards.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const users = await prisma.user.findMany({ orderBy: { role: "asc" } });

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background:
          "radial-gradient(circle at top left, var(--gt-purple-700), var(--gt-purple-950) 60%)",
      }}
    >
      <div className="w-full max-w-4xl grid md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl">
        <div
          className="p-10 text-white flex flex-col justify-between"
          style={{ background: "linear-gradient(160deg, var(--gt-purple-800), var(--gt-purple-950))" }}
        >
          <div>
            <div className="gt-brand mb-8">
              <span className="gt-brand-mark">SP</span>
              <span>SAMPADA Assessment Portal</span>
            </div>
            <h1 className="text-2xl font-extrabold leading-snug mb-3">
              Rule-driven scrutiny &amp; recommendation engine for the 7 PMKSY schemes
            </h1>
            <p className="text-sm text-white/70 leading-relaxed">
              Ingests applications received on sampada-mofpi.gov.in, runs eligibility and
              scoring criteria drawn from each scheme&apos;s guideline, and produces an
              executive-ready recommendation for every proposal.
            </p>
          </div>
          <ul className="text-xs text-white/60 space-y-1.5 mt-10">
            <li>&bull; Food Testing Laboratory (FTL)</li>
            <li>&bull; Integrated Cold Chain</li>
            <li>&bull; Creation/Expansion of Processing Capacities (CEFPPC)</li>
            <li>&bull; Agro Processing Cluster (APC)</li>
            <li>&bull; Backward &amp; Forward Linkages (CBFL)</li>
            <li>&bull; Operation Greens</li>
            <li>&bull; Mega Food Park (MFP)</li>
          </ul>
        </div>
        <div className="bg-white p-10">
          <h2 className="gt-page-title mb-1">Sign in</h2>
          <p className="gt-page-subtitle mb-6">
            Demo access &mdash; select your role to continue. No external accounts are used.
          </p>
          {error && (
            <div className="gt-badge gt-badge-danger mb-4">Invalid selection, try again</div>
          )}
          <div className="space-y-3">
            {users.map((u) => (
              <form action={loginAsUser} key={u.id}>
                <input type="hidden" name="userId" value={u.id} />
                <button
                  type="submit"
                  className="w-full text-left border border-[var(--gt-border)] rounded-xl p-4 hover:border-[var(--gt-purple-500)] hover:bg-[var(--gt-purple-50)] transition flex items-center justify-between group"
                >
                  <div>
                    <div className="font-semibold text-sm text-[var(--gt-ink)]">{u.name}</div>
                    <div className="text-xs text-[var(--gt-muted)] mt-0.5">
                      {ROLE_DESCRIPTIONS[u.role]}
                    </div>
                  </div>
                  <span className="gt-badge gt-badge-neutral">{ROLE_LABELS[u.role]}</span>
                </button>
              </form>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

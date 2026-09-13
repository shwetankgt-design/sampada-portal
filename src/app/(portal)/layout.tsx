import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/session";
import { logout } from "@/lib/actions/auth";
import { NavLink } from "./_components/NavLink";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="gt-shell">
      <aside className="gt-sidebar">
        <div className="gt-brand">
          <span className="gt-brand-mark">SP</span>
          <span>SAMPADA Assessment</span>
        </div>

        <nav className="flex flex-col gap-1">
          <div className="gt-nav-section">Overview</div>
          <NavLink href="/dashboard" label="Executive Dashboard" icon="chart" />
          <NavLink href="/dashboard/grants" label="Grant Monitoring" icon="grant" />

          <div className="gt-nav-section">Applications</div>
          <NavLink href="/applications" label="All Applications" icon="inbox" />
          {(user.role === "OFFICER" || user.role === "ADMIN") && (
            <NavLink href="/applications/new" label="New Application" icon="plus" />
          )}

          <div className="gt-nav-section">Schemes</div>
          <NavLink href="/schemes" label="7 PMKSY Schemes" icon="grid" />

          {user.role === "ADMIN" && (
            <>
              <div className="gt-nav-section">Administration</div>
              <NavLink href="/admin" label="Rule Engine Config" icon="settings" />
              <NavLink href="/admin/users" label="Users &amp; Roles" icon="users" />
            </>
          )}
        </nav>

        <div className="mt-auto pt-4 border-t border-white/10 text-xs text-white/60">
          Ministry of Food Processing Industries
          <br />
          Pradhan Mantri Kisan SAMPADA Yojana
        </div>
      </aside>

      <div className="gt-main">
        <header className="gt-topbar">
          <div className="text-sm font-semibold text-[var(--gt-ink)]">
            Application Processing &amp; Recommendation Portal
          </div>
          <div className="flex items-center gap-3">
            <span className="gt-badge gt-badge-neutral">{ROLE_LABELS[user.role]}</span>
            <span className="text-sm text-[var(--gt-ink)] font-medium">{user.name}</span>
            <form action={logout}>
              <button type="submit" className="gt-btn gt-btn-ghost">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="gt-content">{children}</main>
      </div>
    </div>
  );
}

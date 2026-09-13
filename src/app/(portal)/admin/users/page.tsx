import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({ orderBy: { role: "asc" } });
  return (
    <div>
      <h1 className="gt-page-title">Users &amp; Roles</h1>
      <p className="gt-page-subtitle mb-6">
        Demo roster for this internal portal. In production this would be backed by the
        Ministry&apos;s SSO/AD directory rather than local accounts.
      </p>
      <div className="gt-card !p-0 overflow-hidden">
        <table className="gt-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td className="text-xs text-[var(--gt-muted)]">{u.email}</td>
                <td>
                  <span className="gt-badge gt-badge-neutral">{ROLE_LABELS[u.role]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "gt-badge-neutral" },
  SUBMITTED: { label: "Submitted", cls: "gt-badge-neutral" },
  UNDER_SCRUTINY: { label: "Under Scrutiny", cls: "gt-badge-warning" },
  INELIGIBLE: { label: "Ineligible", cls: "gt-badge-danger" },
  ELIGIBLE_PENDING_SCORE: { label: "Pending Score", cls: "gt-badge-warning" },
  SCORED: { label: "Scored (Below Threshold)", cls: "gt-badge-warning" },
  SHORTLISTED_FOR_PRESENTATION: { label: "Shortlisted", cls: "gt-badge-success" },
  PRESENTED: { label: "Presented", cls: "gt-badge-success" },
  APPROVED: { label: "Approved", cls: "gt-badge-success" },
  REJECTED: { label: "Rejected", cls: "gt-badge-danger" },
  WITHDRAWN: { label: "Withdrawn", cls: "gt-badge-neutral" },
};

export function StatusBadge({ status }: { status: string }) {
  const item = STATUS_MAP[status] || { label: status, cls: "gt-badge-neutral" };
  return <span className={`gt-badge ${item.cls}`}>{item.label}</span>;
}

const VERDICT_MAP: Record<string, { label: string; cls: string }> = {
  RECOMMENDED: { label: "Recommended", cls: "gt-badge-success" },
  NOT_RECOMMENDED: { label: "Not Recommended", cls: "gt-badge-danger" },
  NEEDS_REVIEW: { label: "Needs Review", cls: "gt-badge-warning" },
};

export function VerdictBadge({ verdict }: { verdict: string }) {
  const item = VERDICT_MAP[verdict] || { label: verdict, cls: "gt-badge-neutral" };
  return <span className={`gt-badge ${item.cls}`}>{item.label}</span>;
}

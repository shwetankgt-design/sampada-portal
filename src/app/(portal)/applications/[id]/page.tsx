import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/format";
import { StatusBadge, VerdictBadge } from "../../_components/StatusBadge";
import { getCurrentUser } from "@/lib/session";
import { recordPresentationScore, finalizeApprovalDecision, reassessApplication } from "@/lib/actions/applications";
import { uploadDocument, toggleDocumentVerified } from "@/lib/actions/documents";
import { DOC_TYPES } from "@/lib/documentTypes";
import { docTypesForCategory } from "@/lib/criterionDocs";
import { generateDisbursementSchedule, updateDisbursement } from "@/lib/actions/disbursements";

export const dynamic = "force-dynamic";

const INSTALMENT_LABEL: Record<string, string> = { FIRST: "1st Instalment", SECOND: "2nd Instalment", FINAL: "Final Disbursement" };

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [application, user] = await Promise.all([
    prisma.application.findUnique({
      where: { id },
      include: {
        scheme: { include: { criteria: { orderBy: { sortOrder: "asc" } } } },
        eligibilityChecks: true,
        scores: { include: { criterion: true } },
        recommendation: true,
        dataValues: true,
        documents: { orderBy: { uploadedAt: "desc" } },
        disbursements: { orderBy: { plannedDate: "asc" } },
      },
    }),
    getCurrentUser(),
  ]);
  if (!application) notFound();

  const scoreByCriterion = new Map(application.scores.map((s) => [s.criterionId, s]));
  const childCodes = new Set(
    application.scheme.criteria.filter((c) => c.parentCode).map((c) => c.parentCode)
  );
  const canScorePresentation = user?.role === "APPROVER" || user?.role === "ADMIN";
  const canDecide = user?.role === "APPROVER" || user?.role === "ADMIN";

  const documentLeaves = application.scheme.criteria.filter(
    (c) => c.stage === "DOCUMENT" && !childCodes.has(c.code)
  );
  const presentationLeaves = application.scheme.criteria.filter(
    (c) => c.stage === "PRESENTATION" && !childCodes.has(c.code)
  );

  const dataMap = new Map(application.dataValues.map((d) => [d.fieldKey, d.fieldValue]));
  const submittedFields = buildSubmittedFieldRows(dataMap);
  const documentsByType = new Map<string, typeof application.documents>();
  for (const d of application.documents) {
    const list = documentsByType.get(d.docType) ?? [];
    list.push(d);
    documentsByType.set(d.docType, list);
  }

  return (
    <div>
      <Link href="/applications" className="text-xs text-[var(--gt-purple-700)] hover:underline">
        &larr; All applications
      </Link>
      <div className="flex items-start justify-between mt-1 mb-6">
        <div>
          <h1 className="gt-page-title">{application.applicantName}</h1>
          <p className="gt-page-subtitle">
            {application.applicationNo} &middot; {application.scheme.shortName} &middot;{" "}
            {application.district}, {application.state}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={application.status} />
          {application.recommendation && <VerdictBadge verdict={application.recommendation.verdict} />}
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Param label="Total Project Cost" value={application.totalProjectCost ? formatINR(application.totalProjectCost) : "—"} />
        <Param label="Eligible Project Cost" value={application.eligibleProjectCost ? formatINR(application.eligibleProjectCost) : "—"} />
        <Param label="Subsidy Sought" value={application.subsidySought ? formatINR(application.subsidySought) : "—"} />
        <Param label="Category" value={application.category.replace("_", "/")} />
      </div>

      <div className="gt-card mb-6">
        <div className="gt-card-title mb-1">Application Details (As Submitted)</div>
        <p className="text-xs text-[var(--gt-muted)] mb-3">
          {application.entityType} &middot; {application.applicantName} &middot; submitted{" "}
          {application.submittedAt ? application.submittedAt.toLocaleDateString("en-IN") : "—"}
          {application.isDifficultArea ? " · Difficult Area" : ""}
        </p>
        {submittedFields.length === 0 ? (
          <p className="text-xs text-[var(--gt-muted)]">No structured data was captured at intake for this application.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-x-6 gap-y-3">
            {submittedFields.map((f) => (
              <div key={f.label}>
                <div className="text-[0.68rem] text-[var(--gt-muted)] font-semibold uppercase tracking-wide">
                  {f.label}
                </div>
                <div className="text-sm text-[var(--gt-ink)] font-medium">{f.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {application.recommendation && (
        <div className="gt-card mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="gt-card-title">Rule Engine Recommendation</div>
              <p className="text-xs text-[var(--gt-muted)]">
                Eligibility: {application.recommendation.eligibilityPassed ? "Passed" : "Failed"} &middot;
                {" "}Score {application.recommendation.totalScore.toFixed(1)} / {application.recommendation.maxScore} (
                {application.recommendation.percentageScore.toFixed(1)}%)
              </p>
            </div>
            <VerdictBadge verdict={application.recommendation.verdict} />
          </div>
          <div className="gt-progress-track mt-3">
            <div
              className="gt-progress-fill"
              style={{ width: `${Math.min(100, application.recommendation.percentageScore)}%` }}
            />
          </div>
          {canDecide && application.recommendation.verdict !== "NEEDS_REVIEW" && application.status !== "APPROVED" && application.status !== "REJECTED" && (
            <div className="flex gap-2 mt-4">
              <form action={finalizeApprovalDecision}>
                <input type="hidden" name="applicationId" value={application.id} />
                <input type="hidden" name="decision" value="APPROVED" />
                <button className="gt-btn gt-btn-primary" type="submit">
                  Approve for Financial Assistance
                </button>
              </form>
              <form action={finalizeApprovalDecision}>
                <input type="hidden" name="applicationId" value={application.id} />
                <input type="hidden" name="decision" value="REJECTED" />
                <button className="gt-btn gt-btn-ghost" type="submit">
                  Reject
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {application.status === "APPROVED" && (
        <div className="gt-card mb-6">
          <div className="gt-card-title mb-1">Grant Approval &amp; Disbursement Tracker</div>
          <p className="text-xs text-[var(--gt-muted)] mb-3">
            Outer submission deadline: {application.approvalLetterDate ? new Date(application.approvalLetterDate.getTime() + application.scheme.outerSubmissionDays * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}{" "}
            ({application.scheme.outerSubmissionDays} days from approval letter).
          </p>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <Param label="Approval Letter Date" value={fmtDate(application.approvalLetterDate)} />
            <Param label="Approved Grant Amount" value={application.approvedGrantAmount ? formatINR(application.approvedGrantAmount) : "—"} />
            <Param
              label="Total Disbursed"
              value={formatINR(
                application.disbursements.filter((d) => d.status === "RELEASED").reduce((s, d) => s + d.amount, 0)
              )}
            />
          </div>

          {application.disbursements.length === 0 ? (
            canDecide ? (
              <form action={generateDisbursementSchedule}>
                <input type="hidden" name="applicationId" value={application.id} />
                <button type="submit" className="gt-btn gt-btn-secondary">
                  Generate Disbursement Schedule (1st / 2nd / Final)
                </button>
              </form>
            ) : (
              <p className="text-xs text-[var(--gt-muted)]">Disbursement schedule not yet generated.</p>
            )
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {application.disbursements.map((d) => (
                <div key={d.id} className="border border-[var(--gt-border)] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[var(--gt-purple-800)]">{INSTALMENT_LABEL[d.installment]}</span>
                    <span
                      className={`gt-badge ${d.status === "RELEASED" ? "gt-badge-success" : d.status === "DELAYED" ? "gt-badge-danger" : "gt-badge-neutral"}`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <div className="text-sm font-semibold mb-1">{formatINR(d.amount)}</div>
                  <div className="text-xs text-[var(--gt-muted)] mb-2">Planned: {fmtDate(d.plannedDate)}</div>
                  {canDecide ? (
                    <form action={updateDisbursement} className="space-y-2">
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="applicationId" value={application.id} />
                      <select name="status" defaultValue={d.status} className="gt-select !py-1 text-xs">
                        <option value="PLANNED">Planned</option>
                        <option value="RELEASED">Released</option>
                        <option value="DELAYED">Delayed</option>
                      </select>
                      <input
                        type="date"
                        name="actualDate"
                        defaultValue={d.actualDate ? d.actualDate.toISOString().slice(0, 10) : ""}
                        placeholder="Actual release date"
                        className="gt-input !py-1 text-xs"
                      />
                      <input
                        type="text"
                        name="delayReason"
                        defaultValue={d.delayReason || ""}
                        placeholder="Reason for delay (if delayed)"
                        className="gt-input !py-1 text-xs"
                      />
                      <input
                        type="date"
                        name="revisedExpectedDate"
                        defaultValue={d.revisedExpectedDate ? d.revisedExpectedDate.toISOString().slice(0, 10) : ""}
                        className="gt-input !py-1 text-xs"
                      />
                      <button type="submit" className="gt-btn gt-btn-secondary !py-1 text-xs w-full">
                        Save
                      </button>
                    </form>
                  ) : (
                    <>
                      {d.status === "RELEASED" && (
                        <div className="text-xs text-[var(--gt-success)]">Released {fmtDate(d.actualDate)}</div>
                      )}
                      {d.status === "DELAYED" && (
                        <div className="text-xs text-[var(--gt-danger)]">
                          {d.delayReason}
                          <br />
                          Revised ETA: {fmtDate(d.revisedExpectedDate)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="gt-card mb-6">
        <div className="gt-card-title mb-3">Eligibility Gate</div>
        <table className="gt-table">
          <thead>
            <tr>
              <th style={{ width: 90 }}>Result</th>
              <th>Check</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {application.eligibilityChecks.map((c) => (
              <tr key={c.id}>
                <td>
                  <span className={`gt-badge ${c.passed ? "gt-badge-success" : "gt-badge-danger"}`}>
                    {c.passed ? "Pass" : "Fail"}
                  </span>
                </td>
                <td>{c.label}</td>
                <td className="text-xs text-[var(--gt-muted)]">{c.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="gt-card mb-6">
        <div className="gt-card-title mb-3">Supporting Documents</div>
        <form
          action={uploadDocument}
          encType="multipart/form-data"
          className="flex flex-wrap items-end gap-3 mb-4"
        >
          <input type="hidden" name="applicationId" value={application.id} />
          <div>
            <label className="gt-label">Document Type</label>
            <select name="docType" className="gt-select">
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="gt-label">File</label>
            <input type="file" name="file" required className="text-xs" />
          </div>
          <button type="submit" className="gt-btn gt-btn-secondary">
            Upload
          </button>
        </form>
        {application.documents.length === 0 ? (
          <p className="text-xs text-[var(--gt-muted)]">No documents uploaded yet.</p>
        ) : (
          <table className="gt-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>File</th>
                <th>Uploaded</th>
                <th>Verified</th>
              </tr>
            </thead>
            <tbody>
              {application.documents.map((d) => (
                <tr key={d.id}>
                  <td>{d.docType}</td>
                  <td>
                    {d.filePath ? (
                      <a href={d.filePath} target="_blank" className="text-[var(--gt-purple-700)] hover:underline">
                        {d.fileName}
                      </a>
                    ) : (
                      d.fileName
                    )}
                  </td>
                  <td className="text-xs text-[var(--gt-muted)]">{d.uploadedAt.toLocaleDateString("en-IN")}</td>
                  <td>
                    <form action={toggleDocumentVerified}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="applicationId" value={application.id} />
                      <input type="hidden" name="verified" value={String(d.verified)} />
                      <button type="submit" className={`gt-badge ${d.verified ? "gt-badge-success" : "gt-badge-neutral"}`}>
                        {d.verified ? "Verified" : "Pending"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="gt-card mb-6">
        <div className="gt-card-title mb-1">Document-Stage Scoring</div>
        <p className="text-xs text-[var(--gt-muted)] mb-3">
          Each criterion is cross-referenced against the relevant document type uploaded above, with the reason
          the score was (or was not) awarded.
        </p>
        <table className="gt-table">
          <thead>
            <tr>
              <th style={{ width: 55 }}>Code</th>
              <th>Criterion</th>
              <th style={{ width: 80 }}>Awarded</th>
              <th style={{ width: 60 }}>Max</th>
              <th style={{ width: 160 }}>Linked Document(s)</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {documentLeaves.map((c) => {
              const s = scoreByCriterion.get(c.id);
              const relevantTypes = docTypesForCategory(c.category);
              const linkedDocs = relevantTypes.flatMap((t) => documentsByType.get(t) ?? []);
              return (
                <tr key={c.id}>
                  <td className="font-mono">{c.code}</td>
                  <td>
                    <span className="text-[var(--gt-muted)] text-xs">{c.category}</span>
                    <br />
                    {c.label}
                  </td>
                  <td className="font-semibold">{s ? s.marksAwarded : 0}</td>
                  <td>{c.maxMarks}</td>
                  <td>
                    {linkedDocs.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {linkedDocs.map((d) => (
                          <a
                            key={d.id}
                            href={d.filePath || undefined}
                            target="_blank"
                            className="text-xs text-[var(--gt-purple-700)] hover:underline"
                          >
                            {d.docType}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--gt-danger)]">
                        No {relevantTypes[0]} uploaded
                      </span>
                    )}
                  </td>
                  <td className="text-xs text-[var(--gt-muted)]">{s?.remarks || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="gt-card mb-6">
        <div className="gt-card-title mb-3">Presentation-Stage Scoring (Project Approval Committee)</div>
        {!canScorePresentation && (
          <p className="text-xs text-[var(--gt-muted)] mb-3">
            Only a PAC Approver or Administrator can record presentation marks.
          </p>
        )}
        <table className="gt-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Code</th>
              <th>Criterion</th>
              <th style={{ width: 70 }}>Max</th>
              <th style={{ width: 140 }}>Marks Awarded</th>
              <th>Reason for Marks Awarded / Not Awarded</th>
            </tr>
          </thead>
          <tbody>
            {presentationLeaves.map((c) => {
              const s = scoreByCriterion.get(c.id);
              return (
                <tr key={c.id}>
                  <td className="font-mono">{c.code}</td>
                  <td>{c.label}</td>
                  <td>{c.maxMarks}</td>
                  <td>
                    {canScorePresentation ? (
                      <input
                        form={`presentation-form-${c.id}`}
                        type="number"
                        name="marksAwarded"
                        min={0}
                        max={c.maxMarks}
                        step="0.5"
                        defaultValue={s ? s.marksAwarded : undefined}
                        className="gt-input !w-20 !py-1"
                      />
                    ) : (
                      (s?.marksAwarded ?? "—")
                    )}
                  </td>
                  <td>
                    {canScorePresentation ? (
                      <form id={`presentation-form-${c.id}`} action={recordPresentationScore} className="flex items-center gap-2">
                        <input type="hidden" name="applicationId" value={application.id} />
                        <input type="hidden" name="criterionId" value={c.id} />
                        <input
                          type="text"
                          name="remarks"
                          placeholder="Why this score was / wasn't awarded"
                          defaultValue={s?.remarks || ""}
                          className="gt-input !py-1 text-xs"
                        />
                        <button type="submit" className="gt-btn gt-btn-secondary !py-1 !px-2 text-xs whitespace-nowrap">
                          Save
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-[var(--gt-muted)]">{s?.remarks || "—"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {canScorePresentation && (
          <form action={reassessApplication} className="mt-4">
            <input type="hidden" name="applicationId" value={application.id} />
            <button type="submit" className="gt-btn gt-btn-primary">
              Recompute Recommendation
            </button>
          </form>
        )}
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

const SUBMITTED_FIELD_LABELS: Record<string, { label: string; format: (v: string) => string }> = {
  equityPct: { label: "Promoter's Equity", format: (v) => `${v}% of TPC` },
  termLoanPct: { label: "Term Loan Sanctioned", format: (v) => `${v}% of TPC` },
  netWorth: { label: "Combined Net Worth", format: (v) => formatINR(Number(v)) },
  irrPct: { label: "Project IRR", format: (v) => `${v}%` },
  avgDscr: { label: "Average DSCR", format: (v) => v },
  hasDetailedAppraisalNote: { label: "Detailed Appraisal Note Submitted", format: (v) => (v === "true" ? "Yes" : "No") },
  hasStatutoryDocs: { label: "Statutory Documents Submitted", format: (v) => (v === "true" ? "Yes" : "No") },
  isInsolvent: { label: "Entity Insolvent / Under Legal Proceedings", format: (v) => (v === "true" ? "Yes" : "No") },
  coolOffSatisfied: { label: "Cool-off Period Satisfied", format: (v) => (v === "true" ? "Yes" : "No") },
  maxProjectsSatisfied: { label: "Within Max Projects Limit", format: (v) => (v === "true" ? "Yes" : "No") },
  isScSt: { label: "SC/ST Stake >= 51%", format: (v) => (v === "true" ? "Yes" : "No") },
  scstNetWorthSharePct: { label: "SC/ST Share of Net Worth", format: (v) => `${v}%` },
};

function buildSubmittedFieldRows(dataMap: Map<string, string>): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const [key, config] of Object.entries(SUBMITTED_FIELD_LABELS)) {
    const raw = dataMap.get(key);
    if (raw === undefined || raw === "") continue;
    rows.push({ label: config.label, value: config.format(raw) });
  }
  return rows;
}

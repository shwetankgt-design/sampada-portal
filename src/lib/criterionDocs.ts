import type { DOC_TYPES } from "@/lib/documentTypes";

type DocType = (typeof DOC_TYPES)[number];

/**
 * Heuristically maps a scoring criterion's category label to the document
 * type(s) an officer would use to verify it, so the application detail page
 * can show "which uploaded document backs this score" next to each criterion.
 */
export function docTypesForCategory(category: string): DocType[] {
  const c = category.toLowerCase();
  const rules: [RegExp, DocType[]][] = [
    [/land|building/, ["Land Title / Lease Deed"]],
    [/economic viability|dscr|irr/, ["Bank Appraisal Note", "Term Loan Sanction Letter"]],
    [/project cost/, ["DPR", "Bank Appraisal Note"]],
    [/equipment|technology|cluster scale|linkage|value chain|committed processing|processing units/, [
      "Equipment Quotations",
      "DPR",
    ]],
    [/msme/, ["PAN / GSTIN / MSME Udyam"]],
    [/women/, ["Certificate of Incorporation / MoA / By-laws"]],
    [/prior subsidy/, ["Other"]],
    [/district|nabl|gap|priority|regional/, ["DPR"]],
    [/logistics|connectivity|proximity|market|transport|port|airport/, ["DPR"]],
    [/presentation/, ["DPR"]],
  ];
  for (const [pattern, types] of rules) {
    if (pattern.test(c)) return types;
  }
  return ["Other"];
}

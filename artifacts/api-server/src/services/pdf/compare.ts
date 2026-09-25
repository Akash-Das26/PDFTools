import type { Request, Response } from "express";
import type { ComparePdfOptionsInput } from "@workspace/api-zod";
import { extractDoc } from "./extract";
import { badRequest, baseName, failTool, requireUploadedFiles } from "./shared";

/**
 * LCS diff is O(n*m); beyond this many lines per document the table would cost
 * tens of megabytes per request, so larger files fall back to the set-based
 * summary (which still lists what was added and removed, just without ordering).
 */
const MAX_DIFF_LINES = 2000;

/** Unchanged lines kept on either side of a change before a run is collapsed. */
const CONTEXT_LINES = 2;

/** Upper bound on diff lines written into the report to keep it readable. */
const MAX_REPORT_LINES = 2000;

interface DiffLine {
  text: string;
  /** 1-based page the line came from in its own document. */
  page: number;
}

interface DiffOp {
  type: "equal" | "add" | "remove";
  text: string;
  page: number;
}

/** Trims each line and drops blanks — PDF extraction pads and wraps unpredictably. */
function toLines(pages: Array<{ num: number; text: string }>): DiffLine[] {
  const lines: DiffLine[] = [];
  for (const page of pages) {
    for (const raw of page.text.split(/\r?\n/)) {
      const text = raw.replace(/\s+$/g, "").replace(/^[ \t]+/, "");
      if (text) lines.push({ text, page: page.num });
    }
  }
  return lines;
}

/** Classic LCS table + walk, returning per-line add/remove/equal operations. */
function diffLines(a: DiffLine[], b: DiffLine[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const table = new Int32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        a[i]!.text === b[j]!.text
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i]!.text === b[j]!.text) {
      ops.push({ type: "equal", text: a[i]!.text, page: a[i]!.page });
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      ops.push({ type: "remove", text: a[i]!.text, page: a[i]!.page });
      i += 1;
    } else {
      ops.push({ type: "add", text: b[j]!.text, page: b[j]!.page });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ type: "remove", text: a[i]!.text, page: a[i]!.page });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: "add", text: b[j]!.text, page: b[j]!.page });
    j += 1;
  }

  return ops;
}

/** Set-based fallback for documents too large for the LCS table. */
function summariseLarge(a: DiffLine[], b: DiffLine[]): DiffOp[] {
  const counts = new Map<string, number>();
  for (const line of a) counts.set(line.text, (counts.get(line.text) ?? 0) + 1);

  const ops: DiffOp[] = [];
  for (const line of a) {
    const remaining = counts.get(line.text) ?? 0;
    if (remaining > 0) {
      counts.set(line.text, remaining - 1);
      ops.push({ type: "equal", text: line.text, page: line.page });
    } else {
      ops.push({ type: "remove", text: line.text, page: line.page });
    }
  }
  for (const line of b) {
    const remaining = counts.get(line.text) ?? 0;
    if (remaining > 0) {
      counts.set(line.text, remaining - 1);
      ops.push({ type: "equal", text: line.text, page: line.page });
    } else {
      ops.push({ type: "add", text: line.text, page: line.page });
    }
  }
  return ops;
}

/** Renders the operation stream with collapsed context, as a unified-style diff. */
function renderDiff(ops: DiffOp[]): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i]!.type === "equal") {
      let j = i;
      while (j < ops.length && ops[j]!.type === "equal") j += 1;
      const run = j - i;
      if (run <= CONTEXT_LINES * 2) {
        for (let k = i; k < j; k += 1) lines.push(`  ${ops[k]!.text}`);
      } else {
        for (let k = i; k < i + CONTEXT_LINES; k += 1) lines.push(`  ${ops[k]!.text}`);
        lines.push(`  … ${run - CONTEXT_LINES * 2} unchanged line(s)`);
        for (let k = j - CONTEXT_LINES; k < j; k += 1) lines.push(`  ${ops[k]!.text}`);
      }
      i = j;
      continue;
    }
    const op = ops[i]!;
    lines.push(`${op.type === "add" ? "+" : "-"} ${op.text}   (p.${op.page})`);
    i += 1;
  }
  return lines;
}

/** Picks a fence longer than any backtick run in the body so the block cannot break. */
function fenceFor(body: string): string {
  const runs: string[] = body.match(/`+/g) ?? [];
  let longest = 0;
  for (const run of runs) longest = Math.max(longest, run.length);
  return "`".repeat(Math.max(3, longest + 1));
}

/**
 * Compares the text of two PDFs and returns a JSON report: summary counts, the
 * ordered diff operations the UI renders, and a ready-made Markdown rendering
 * the client can download. The diff is line-based on extracted text, so it
 * reports wording and structural changes rather than pixel or layout changes.
 */
export async function comparePdfs(
  req: Request,
  res: Response,
  _options: ComparePdfOptionsInput,
): Promise<void> {
  try {
    const files = requireUploadedFiles(req);
    if (files.length !== 2) {
      throw badRequest(`Select exactly two PDFs to compare — ${files.length} were uploaded.`);
    }

    const [first, second] = files as [Express.Multer.File, Express.Multer.File];
    const [docA, docB] = await Promise.all([extractDoc(first.buffer), extractDoc(second.buffer)]);

    const linesA = toLines(docA.pages);
    const linesB = toLines(docB.pages);

    if (linesA.length === 0 && linesB.length === 0) {
      throw badRequest("Neither PDF contains extractable text — there is nothing to compare.");
    }

    const large = linesA.length > MAX_DIFF_LINES || linesB.length > MAX_DIFF_LINES;
    const ops = large ? summariseLarge(linesA, linesB) : diffLines(linesA, linesB);

    const added = ops.filter((op) => op.type === "add").length;
    const removed = ops.filter((op) => op.type === "remove").length;
    const unchanged = ops.filter((op) => op.type === "equal").length;

    const nameA = baseName(first.originalname, "original");
    const nameB = baseName(second.originalname, "revised");

    const identical = added === 0 && removed === 0;

    const report: string[] = [
      "# PDF comparison",
      "",
      `- **A:** ${nameA}.pdf — ${docA.pageCount} page(s), ${linesA.length} text line(s)`,
      `- **B:** ${nameB}.pdf — ${docB.pageCount} page(s), ${linesB.length} text line(s)`,
      "",
      "## Summary",
      "",
    ];

    let truncated = false;

    if (identical) {
      report.push("The extracted text is **identical** in both documents.", "");
    } else {
      report.push(
        `- ${unchanged} line(s) unchanged`,
        `- ${removed} line(s) removed`,
        `- ${added} line(s) added`,
        "",
      );
      if (large) {
        report.push(
          "> These documents are large, so differences are listed without their original ordering.",
          "",
        );
      }
      report.push("## Differences (A → B)", "");
      const diffLinesOut = renderDiff(ops);
      truncated = diffLinesOut.length > MAX_REPORT_LINES;
      const body = diffLinesOut.slice(0, MAX_REPORT_LINES).join("\n");
      const fence = fenceFor(body);
      report.push(`${fence}diff`, body, fence, "");
      if (truncated) {
        report.push(`> Report truncated to ${MAX_REPORT_LINES} lines.`, "");
      }
    }

    req.log.info(
      { added, removed, unchanged, large, pagesA: docA.pageCount, pagesB: docB.pageCount },
      "Compared PDFs",
    );

    res.json({
      a: { name: nameA, pages: docA.pageCount, lines: linesA.length },
      b: { name: nameB, pages: docB.pageCount, lines: linesB.length },
      identical,
      large,
      truncated,
      counts: { unchanged, removed, added },
      diff: ops.slice(0, MAX_REPORT_LINES),
      report: report.join("\n"),
      filename: `${nameA}_vs_${nameB}_comparison.md`,
    });
  } catch (err) {
    failTool(req, res, err, "Compare failed", "Failed to compare the PDFs");
  }
}

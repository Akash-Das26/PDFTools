import type { Request, Response } from "express";
import type { PdfToExcelOptionsInput } from "@workspace/api-zod";
import {
  baseName,
  failTool,
  parsePageSelection,
  requirePdfFile,
  sendBuffer,
  sendZip,
  unprocessable,
} from "./shared";
import { withPdfParser } from "./pdfjs";

/**
 * PDF to Excel, in the CSV form the feature audit sanctioned: pdf-parse's
 * rule-based table detector reads the cells, this service turns them into CSV
 * text. One table downloads as `.csv`; several download as a ZIP of per-table
 * files — the same single/multiple contract the split and pdf-to-images tools
 * use.
 *
 * The detector needs *ruled* tables: it builds its grid from drawn horizontal
 * and vertical lines (probed this session — a borderless column layout yields
 * nothing). A document with no ruled table is a 422 that says so, not an empty
 * spreadsheet the user would only discover after opening it.
 */

/** Escapes one cell for CSV: quotes wrap anything holding the delimiter, a quote or a newline. */
function csvCell(value: string, delimiter: string): string {
  const clean = value.replace(/\r?\n/g, " ").trim();
  if (clean.includes(delimiter) || clean.includes('"')) {
    return `"${clean.replace(/"/g, '""')}"`;
  }
  return clean;
}

function toCsv(rows: string[][], delimiter: string): string {
  return rows.map((row) => row.map((cell) => csvCell(cell, delimiter)).join(delimiter)).join("\r\n") + "\r\n";
}

export async function pdfToExcel(
  req: Request,
  res: Response,
  options: PdfToExcelOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const delimiter = options.delimiter === "tab" ? "\t" : options.delimiter;

    const result = await withPdfParser(file.buffer, async (parser) => await parser.getTable());

    const indices = parsePageSelection(options.pages, result.pages.length, { fallbackToAll: true });
    const selected = new Set(indices);

    const tables = result.pages
      .filter((page) => selected.has(page.num - 1))
      .flatMap((page) =>
        page.tables.map((rows, index) => ({
          num: page.num,
          /** Tables on this page, for the ZIP naming. */
          onPage: page.tables.length,
          index: index + 1,
          rows,
        })),
      );

    if (tables.length === 0) {
      throw unprocessable(
        "No ruled tables were found in this PDF. The table detector reads grids drawn with lines — " +
          "a layout of plain text columns without rules is not something it can see. " +
          "Extract Text exports the text instead.",
      );
    }

    const base = baseName(file.originalname, "tables");

    if (tables.length === 1) {
      sendBuffer(res, Buffer.from(toCsv(tables[0].rows, delimiter), "utf8"), {
        filename: `${base}.csv`,
        // The BOM makes Excel read the UTF-8 text as UTF-8 rather than as the
        // system codepage, which mangles anything outside ASCII.
        contentType: "text/csv; charset=utf-8",
      });
      return;
    }

    await sendZip(
      res,
      tables.map((table) => ({
        name:
          table.onPage > 1
            ? `page-${table.num}-table-${table.index}.csv`
            : `page-${table.num}.csv`,
        data: Buffer.from(toCsv(table.rows, delimiter), "utf8"),
      })),
      `${base}-csv.zip`,
    );
  } catch (err) {
    failTool(req, res, err, "PDF to Excel failed", "Failed to extract tables from PDF");
  }
}

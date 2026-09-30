import type { Request, Response } from "express";
import type { PdfFormFillerOptionsInput, PdfFormInspectOptionsInput } from "@workspace/api-zod";
import {
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField,
  type PDFField,
} from "@cantoo/pdf-lib";
import {
  badRequest,
  baseName,
  failTool,
  loadPdf,
  requirePdfFile,
  sendPdf,
  unprocessable,
} from "./shared";

/**
 * The two form endpoints: `/pdf/pdf-form-inspect` answers with the field
 * inventory (so the UI can build its inputs before anything is filled), and
 * `/pdf/pdf-form-filler` writes values into those fields, optionally
 * flattening the result so the answers become page content.
 *
 * Values travel as one JSON object keyed by field name rather than as one
 * multipart field per answer — a form with forty fields would otherwise need
 * forty parts and a spec table to match. Only the four field kinds pdf-lib can
 * write are accepted; signatures and pushbuttons are reported by inspect but
 * the filler refuses them rather than silently skipping.
 */

/** The shape `inspect` answers with and the panel consumes. */
interface FormFieldInfo {
  name: string;
  type: "text" | "checkbox" | "dropdown" | "optionlist" | "radio" | "signature" | "button";
  /** Current text value, for text fields. */
  value?: string;
  /** Current checked state, for checkboxes. */
  checked?: boolean;
  /** Chosen option(s), for dropdowns, option lists and radio groups. */
  selected?: string[];
  /** Every choice a dropdown, option list or radio group offers. */
  options?: string[];
  /** Max characters for text fields, when the document declares one. */
  maxLength?: number;
  /** True when the document itself says the field may not be edited. */
  readOnly?: boolean;
}

function fieldInfo(field: PDFField): FormFieldInfo {
  const name = field.getName();
  if (field instanceof PDFTextField) {
    return {
      name,
      type: "text",
      value: field.getText() ?? "",
      maxLength: field.getMaxLength(),
      readOnly: field.isReadOnly(),
    };
  }
  if (field instanceof PDFCheckBox) {
    return { name, type: "checkbox", checked: field.isChecked(), readOnly: field.isReadOnly() };
  }
  if (field instanceof PDFDropdown) {
    return {
      name,
      type: "dropdown",
      selected: field.getSelected() ?? [],
      options: field.getOptions(),
      readOnly: field.isReadOnly(),
    };
  }
  if (field instanceof PDFOptionList) {
    return {
      name,
      type: "optionlist",
      selected: field.getSelected() ?? [],
      options: field.getOptions(),
      readOnly: field.isReadOnly(),
    };
  }
  if (field instanceof PDFRadioGroup) {
    const selected = field.getSelected();
    return {
      name,
      type: "radio",
      selected: selected === undefined ? [] : [selected],
      options: field.getOptions(),
      readOnly: field.isReadOnly(),
    };
  }
  if (field instanceof PDFSignature) return { name, type: "signature" };
  return { name, type: "button" };
}

/** Answers the field inventory of an AcroForm. A PDF without fields is a 422, not an empty list. */
export async function inspectPdfForm(
  req: Request,
  res: Response,
  _options: PdfFormInspectOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const document = await loadPdf(file.buffer);
    const form = document.getForm();
    const fields = form.getFields().map(fieldInfo);

    if (fields.length === 0) {
      throw unprocessable(
        "This PDF has no form fields to fill. It may be a flat document, or the form was flattened when it was created.",
      );
    }

    res.json({
      fieldCount: fields.length,
      fields,
      // The service flattens with pdf-lib's appearance-update pass; this flag
      // is informational for the UI's copy.
      flattenable: true,
    });
  } catch (err) {
    failTool(req, res, err, "Form inspect failed", "Failed to read the PDF form fields");
  }
}

type FieldValues = Record<string, string | boolean | number>;

/** Parses and type-checks the posted values JSON. */
function parseValues(raw: string): FieldValues {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw badRequest("\"values\" is not valid JSON — send an object keyed by field name");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw badRequest("\"values\" must be a JSON object keyed by field name");
  }
  const out: FieldValues = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
      out[key] = value;
    } else {
      throw badRequest(`The value for "${key}" must be a string, boolean or number`);
    }
  }
  return out;
}

/**
 * Fills the fields named in `values` and returns the document. Every name is
 * matched against the real inventory first, so a typo is a 422 naming the
 * unknown key and every unfilled field, never a silent partial fill.
 */
export async function fillPdfForm(
  req: Request,
  res: Response,
  options: PdfFormFillerOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const values = parseValues(options.values);
    if (Object.keys(values).length === 0) {
      throw badRequest("Fill at least one field — an empty fill would return the document unchanged");
    }
    const document = await loadPdf(file.buffer);
    const form = document.getForm();
    const fields = form.getFields();

    if (fields.length === 0) {
      throw unprocessable("This PDF has no form fields to fill");
    }

    const byName = new Map(fields.map((field) => [field.getName(), field]));
    const unknown = Object.keys(values).filter((name) => !byName.has(name));
    if (unknown.length > 0) {
      throw unprocessable(
        `This form has no field named ${unknown.map((n) => `"${n}"`).join(", ")}. ` +
          `The fields it does have: ${fields.map((f) => `"${f.getName()}"`).join(", ")}.`,
      );
    }

    const applied: string[] = [];
    for (const [name, value] of Object.entries(values)) {
      const field = byName.get(name)!;
      if (field instanceof PDFTextField) {
        if (typeof value === "boolean") {
          throw badRequest(`"${name}" is a text field — send a string, not true/false`);
        }
        const max = field.getMaxLength();
        const text = String(value);
        if (max !== undefined && text.length > max) {
          throw badRequest(`"${name}" holds at most ${max} characters — the text has ${text.length}`);
        }
        field.setText(text);
      } else if (field instanceof PDFCheckBox) {
        const checked = value === true || value === "true";
        if (checked) field.check();
        else field.uncheck();
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList || field instanceof PDFRadioGroup) {
        const option = String(value);
        const choices = field.getOptions();
        if (!choices.includes(option)) {
          throw badRequest(
            `"${option}" is not one of "${name}"'s choices: ${choices.map((o) => `"${o}"`).join(", ")}`,
          );
        }
        field.select(option);
      } else {
        throw badRequest(
          `"${name}" is a ${field.constructor.name.replace(/^PDF/, "").toLowerCase()} field, which cannot be filled`,
        );
      }
      applied.push(name);
    }

    if (options.flatten) {
      form.flatten();
    }

    const suffix = options.flatten ? "-filled-flat" : "-filled";
    sendPdf(res, await document.save(), `${baseName(file.originalname, "form")}${suffix}.pdf`);
    req.log.info({ applied: applied.length, flatten: options.flatten }, "form filled");
  } catch (err) {
    failTool(req, res, err, "Form fill failed", "Failed to fill the PDF form");
  }
}

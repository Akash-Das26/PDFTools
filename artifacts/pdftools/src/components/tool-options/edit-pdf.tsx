import { OptionField } from "@/components/tool-options/parts";

/**
 * Edit PDF Content — Configure panel for `POST /pdf/edit`.
 *
 * The API takes a JSON array of text/rect/image ops; this panel builds the
 * flow the card promises first: placing a line of text somewhere specific.
 * Page and position are PDF points (origin bottom-left, so y grows upward).
 * Rectangles and images are API-only for now — the note says so. The ops
 * JSON is rebuilt on every keystroke; an empty text leaves `ops` empty and
 * the tool page refuses to start the run (the protect-password pattern).
 */
export function EditPdfOptions({
  options,
  onChange,
}: {
  options: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const text = typeof options.editText === "string" ? options.editText : "";
  const page = typeof options.editPage === "string" ? options.editPage : "1";
  const x = typeof options.editX === "string" ? options.editX : "72";
  const y = typeof options.editY === "string" ? options.editY : "700";

  const commit = (patch: Record<string, unknown>) => {
    const merged = { editText: text, editPage: page, editX: x, editY: y, ...patch };
    const value = String(merged.editText ?? "").trim();
    if (value.length === 0) {
      onChange({ ...patch, ops: "" });
      return;
    }
    onChange({
      ...patch,
      ops: JSON.stringify([
        {
          type: "text",
          page: Math.max(1, Number.parseInt(String(merged.editPage), 10) || 1),
          x: Number(merged.editX) || 72,
          y: Number(merged.editY) || 700,
          text: value,
          size: 14,
          color: "#111111",
        },
      ]),
    });
  };

  const inputClass =
    "w-full max-w-md rounded-lg border border-border bg-surface-container-lowest px-space-md py-space-sm text-body-md text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField label="Text to place" hint="Added on top of the page">
        <input
          data-testid="edit-text"
          type="text"
          value={text}
          onChange={(event) => commit({ editText: event.target.value })}
          placeholder="Approved — 2026-09-28"
          maxLength={200}
          className={inputClass}
        />
      </OptionField>

      <div className="flex flex-wrap gap-space-md">
        <OptionField label="Page">
          <input
            data-testid="edit-page"
            type="number"
            min={1}
            value={page}
            onChange={(event) => commit({ editPage: event.target.value })}
            className={`${inputClass} max-w-[7rem]`}
          />
        </OptionField>
        <OptionField label="X (pt)">
          <input
            data-testid="edit-x"
            type="number"
            value={x}
            onChange={(event) => commit({ editX: event.target.value })}
            className={`${inputClass} max-w-[7rem]`}
          />
        </OptionField>
        <OptionField label="Y (pt)">
          <input
            data-testid="edit-y"
            type="number"
            value={y}
            onChange={(event) => commit({ editY: event.target.value })}
            className={`${inputClass} max-w-[7rem]`}
          />
        </OptionField>
      </div>

      <p data-testid="edit-note" className="text-body-sm text-muted-foreground">
        Edits are placed on top of the page — existing text is not rewritten,
        because no tool can reflow a PDF's text layer. This panel places text;
        rectangles and images are available through the API. Coordinates are
        PDF points, measuring from the page's bottom-left corner.
      </p>
    </div>
  );
}

import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import type { ToolOptionsProps } from "@/components/tool-options/types";
import { Input } from "@/components/ui/input";

/**
 * Split PDF.
 *
 * `POST /pdf/split` takes `splitType` (`all` | `pages`) and, in `pages` mode,
 * a `pages` selection such as `1,3,5-8`. An empty list in `pages` mode keeps
 * the endpoint's fallback behaviour of splitting every page, which the hint
 * states rather than hides.
 */
export function SplitOptions({ options, onChange }: ToolOptionsProps) {
  const splitType = options.splitType === "pages" ? "pages" : "all";
  const pages = typeof options.pages === "string" ? options.pages : "";

  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField label="Split mode">
        <OptionRadioGroup
          name="splitType"
          value={splitType}
          columns={2}
          onChange={(value) => onChange({ splitType: value })}
          options={[
            {
              value: "all",
              label: "Every page",
              description: "One single-page PDF per page of the document.",
            },
            {
              value: "pages",
              label: "Selected pages",
              description: "Split only the pages you list below.",
            },
          ]}
        />
      </OptionField>

      {splitType === "pages" && (
        <OptionField
          label="Pages to split"
          htmlFor="split-pages"
          hint="Empty splits every page"
        >
          <Input
            id="split-pages"
            data-testid="pages-input"
            value={pages}
            placeholder="1,3,5-8"
            onChange={(event) => onChange({ pages: event.target.value })}
            className="max-w-xs"
          />
        </OptionField>
      )}
    </div>
  );
}

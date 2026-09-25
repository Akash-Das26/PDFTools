import type { ComponentType } from "react";
import { CompressOptions } from "@/components/tool-options/compress";
import { ExtractPagesOptions } from "@/components/tool-options/extract-pages";
import { MergeOptions } from "@/components/tool-options/merge";
import { OrganizePagesOptions } from "@/components/tool-options/organize-pages";
import { RemovePagesOptions } from "@/components/tool-options/remove-pages";
import { RotateOptions } from "@/components/tool-options/rotate";
import { SplitOptions } from "@/components/tool-options/split";
import type { ToolOptionsProps } from "@/components/tool-options/types";
import { uiIcons } from "@/lib/icons";

/**
 * The Configure-panel registry.
 *
 * One entry per tool whose panels are built. `hasOptionsPanel` is what lets the
 * workspace refuse to run a tool whose options are not ready — without it, an
 * implemented endpoint would be called with silently-unset defaults, which for
 * tools like Protect (password required) means a confusing 400 and for tools
 * like Watermark means a document that quietly is not what the user asked for.
 *
 * Tools that genuinely take no options register `NoOptionsPanel` explicitly, so
 * "no panel" always means "not built yet", never "nothing to configure".
 */
function NoOptionsPanel({ note }: { note: string }) {
  return function NoOptions() {
    return (
      <p className="text-body-sm text-muted-foreground" data-testid="no-options">
        {note}
      </p>
    );
  };
}

export const OPTION_PANELS: Record<string, ComponentType<ToolOptionsProps>> = {
  compress: CompressOptions,
  merge: MergeOptions,
  split: SplitOptions,
  "remove-pages": RemovePagesOptions,
  "extract-pages": ExtractPagesOptions,
  "organize-pages": OrganizePagesOptions,
  rotate: RotateOptions,
  "ai-summarize": NoOptionsPanel({
    note: "Runs with the default summarizer settings — a short summary plus key points. No options to set.",
  }),
  compare: NoOptionsPanel({
    note: "Compares the two documents exactly as they are. No options to set.",
  }),
};

export function hasOptionsPanel(toolId: string): boolean {
  return toolId in OPTION_PANELS;
}

/** Fallback shown for tools whose Configure panel has not been built yet. */
export function OptionsNotBuilt({ toolId }: { toolId: string }) {
  return (
    <div
      data-testid="options-not-built"
      className="flex items-start gap-space-sm rounded-lg border border-border bg-surface p-space-md"
    >
      <uiIcons.sliders className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted-foreground" />
      <div className="text-body-sm text-muted-foreground">
        <p className="text-label-md text-foreground">
          Configure panel not built yet
        </p>
        <p className="mt-space-xs">
          The <code className="text-code-sm">{toolId}</code> tool has a live
          backend route, but its options panel is still to come. Processing is
          disabled so the endpoint is never called with unset defaults.
        </p>
      </div>
    </div>
  );
}

/** Render the right Configure panel for a tool, or the placeholder. */
export function ToolOptionsPanel({
  toolId,
  ...props
}: ToolOptionsProps & { toolId: string }) {
  const Panel = OPTION_PANELS[toolId];
  if (!Panel) return <OptionsNotBuilt toolId={toolId} />;
  return <Panel {...props} />;
}

import type { PagePlan } from "@/templates/page-picker-workspace";

/**
 * The contract for a tool-specific Configure panel.
 *
 * These panels are the *only* thing that differs between the 32 tools, which is
 * why they live in one folder and are rendered through one switch
 * (`ToolOptionsPanel`). A panel never talks to the network and never renders
 * chrome — it edits the options record the tool page then posts.
 */
export interface ToolOptionsProps {
  /** Current option values, keyed by the endpoint's form-field names. */
  options: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  /** Present for page-picker tools; absent for stepper tools. */
  pagePlan?: PagePlan;
  /** The selected files. Present so panels like Merge can render and reorder them. */
  files?: File[];
  /** Replace the tool page's file list (merge reordering, removing a file). */
  onFilesChange?: (files: File[]) => void;
  /** The inspected form fields, for the filler panel. Undefined until the document's fields have been read. */
  fields?: import("@/components/tool-options/pdf-form-filler").InspectedFormField[];
}

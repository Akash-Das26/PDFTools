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
}

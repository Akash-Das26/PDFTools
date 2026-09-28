import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { Seo } from "@/components/seo";
import { SiteHeader } from "@/components/site-header";
import { ToolOptionsPanel, hasOptionsPanel } from "@/components/tool-options";
import type { InspectedFormField as FormFieldInfo } from "@/components/tool-options/pdf-form-filler";
import { StepperWorkspace } from "@/templates/stepper-workspace";
import {
  PagePickerWorkspace,
  type PagePlan,
} from "@/templates/page-picker-workspace";
import { takeHandedOffFiles } from "@/lib/file-handoff";
import { useTool } from "@/lib/tool-catalog";
import {
  describeError,
  fetchPageInfo,
  postTool,
  ToolError,
  type PageInfoPage,
} from "@/lib/process-tool";
import type {
  ProgressInfo,
  WorkspaceErrorInfo,
  WorkspacePhase,
  WorkspaceResult,
} from "@/lib/workspace";
import { formatFileSize } from "@/lib/file-utils";

/**
 * Tool workspace.
 *
 * Owns every piece of data flow — file selection, option state, the abortable
 * request, progress, results and error recovery — and hands presentation to one
 * of the two approved templates based on the catalog's `workspace` field. The
 * template switch is deliberately total: `page-picker` for exactly the five
 * page tools, `stepper` for everything else.
 */

/** Status text shown while a job runs. */
const PROCESS_LABELS: Record<string, string> = {
  compress: "Compressing streams...",
  merge: "Merging documents...",
  split: "Splitting pages...",
  rotate: "Rotating pages...",
  "remove-pages": "Removing pages...",
  "reorder-pages": "Rebuilding page order...",
  crop: "Cropping pages...",
  protect: "Encrypting with the selected algorithm...",
  unlock: "Removing document encryption...",
  watermark: "Stamping the watermark...",
  "add-page-numbers": "Stamping page numbers...",
  "pdf-to-images": "Rasterising pages...",
  "images-to-pdf": "Composing images into a PDF...",
  "pdf-to-pdfa": "Writing the PDF/A archive...",
  "extract-text": "Extracting text...",
  "pdf-to-markdown": "Converting to Markdown...",
  "ai-summarize": "Asking the model for a summary...",
  "translate-pdf": "Translating page by page...",
  compare: "Diffing the two documents...",
};

export default function Tool() {
  const { toolId } = useParams<{ toolId: string }>();
  const { tool, isLoading } = useTool(toolId);

  const [phase, setPhase] = useState<WorkspacePhase>("empty");
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<WorkspaceResult | null>(null);
  const [error, setError] = useState<WorkspaceErrorInfo | null>(null);
  const [progress, setProgress] = useState<ProgressInfo>({
    percent: 0,
    label: "Working...",
  });
  const [pagePlan, setPagePlan] = useState<PagePlan | undefined>();
  const [pages, setPages] = useState<PageInfoPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  // The form filler's inspected inventory: null until the document's fields
  // have been read, [] when the read answered "no fields".
  const [formFields, setFormFields] = useState<FormFieldInfo[] | null>(null);
  const [formInspectLoading, setFormInspectLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const fileUrlRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("empty");
    setFiles([]);
    setResult(null);
    setError(null);
    setPages([]);
    setPagePlan(undefined);
    setProgress({ percent: 0, label: "Working..." });
  }, []);

  // Reset whenever the tool changes, so switching tools never carries state.
  useEffect(() => {
    reset();
  }, [toolId, reset]);

  // Claim any file handed off by the landing quick-dropzone.
  useEffect(() => {
    const handed = takeHandedOffFiles();
    if (handed.length > 0) setFiles(handed);
  }, [toolId]);

  useEffect(() => {
    if (files.length > 0 && phase === "empty") setPhase("configuring");
  }, [files, phase]);

  // The form filler needs the field inventory before step 2 renders, for the
  // same reason the page-picker needs the page list: its panel is built from
  // what the document actually contains. This is the only other call with no
  // Process button behind it, so it reports its own failure — a document with
  // no fields is an answer, not a silent empty panel.
  useEffect(() => {
    if (tool?.id !== "pdf-form-filler") return;
    const [single] = files;
    if (files.length !== 1 || !single) {
      setFormFields(null);
      return;
    }

    const controller = new AbortController();
    setFormInspectLoading(true);
    const form = new FormData();
    form.append("file", single);
    fetch("/api/pdf/pdf-form-inspect", { method: "POST", body: form, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? `Could not read the form (${response.status})`);
        }
        return (await response.json()) as { fields: FormFieldInfo[] };
      })
      .then((info) => setFormFields(info.fields))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setFormFields([]);
        setError(
          describeError(
            caught instanceof Error ? caught.message : "Could not read the form fields.",
          ),
        );
        setPhase("error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setFormInspectLoading(false);
      });

    return () => controller.abort();
  }, [tool?.id, files]);

  // Page-picker tools need the page list (and previews) before step 2 renders.
  // This is the only call with no Process button behind it, so it reports its
  // own failure instead of leaving an empty grid with no explanation.
  useEffect(() => {
    if (tool?.workspace !== "page-picker") return;
    const [single] = files;
    if (files.length !== 1 || !single) {
      setPages([]);
      return;
    }

    const controller = new AbortController();
    setPagesLoading(true);
    fetchPageInfo(single, controller.signal)
      .then((info) => setPages(info.pages))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setPages([]);
        setError(
          describeError(
            caught instanceof Error ? caught.message : "Could not read the document.",
          ),
        );
        setPhase("error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setPagesLoading(false);
      });

    return () => controller.abort();
  }, [tool?.workspace, files]);

  // Simulated progress: the transport cannot report real percentages, so the
  // bar eases toward 90% and only completes when the response lands.
  useEffect(() => {
    if (phase !== "processing") return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started;
      setProgress((current) => {
        const ceiling = 90;
        const next = Math.min(ceiling, (elapsed / 40) * 0.9);
        return current.percent >= ceiling
          ? current
          : { ...current, percent: Math.max(current.percent, next) };
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [phase]);

  const buildOptions = useCallback((): Record<string, unknown> => {
    if (!tool) return options;

    if (tool.id === "rotate") {
      // The endpoint requires an explicit angle; default to 90° rather than
      // sending an empty field the server would reject.
      return {
        ...options,
        rotation:
          options.rotation === 180 || options.rotation === 270
            ? options.rotation
            : 90,
      };
    }

    if (tool.id === "pdf-to-markdown") {
      // The shared extract-text endpoint defaults to plain text while this tool
      // promises Markdown. The panel shows Markdown as the selected card, so the
      // request must carry it rather than letting the server default win — the
      // same reason rotate sends its displayed angle explicitly.
      return { ...options, format: options.format === "txt" ? "txt" : "md" };
    }

    if (tool.workspace !== "page-picker") return options;

    const plan = pagePlan;
    const active = (plan?.selected ?? []).filter(
      (page) => !(plan?.removed ?? []).includes(page),
    );
    const kept = (plan?.order ?? []).filter(
      (page) => !(plan?.removed ?? []).includes(page),
    );

    switch (tool.id) {
      case "remove-pages":
        return {
          ...options,
          pages: [...new Set([...active, ...(plan?.removed ?? [])])].join(","),
        };
      case "extract-pages":
        return { ...options, splitType: "pages", pages: active.join(",") };
      case "reorder-pages":
        return { ...options, order: kept.join(",") };
      case "rotate": {
        const pages = active.length > 0 ? active : kept;
        return { ...options, pages: pages.join(",") };
      }
      case "crop":
        // The crop panel's own Pages field wins when the user typed one;
        // otherwise the picker selection (or the whole document) applies.
        if (typeof options.pages === "string" && options.pages.trim() !== "") {
          return options;
        }
        return { ...options, pages: active.join(",") };
      default:
        return { ...options, pages: active.join(",") };
    }
  }, [options, pagePlan, tool]);

  const process = useCallback(async () => {
    if (!tool) return;
    if (tool.id === "protect" &&
        (typeof options.password !== "string" || options.password.length === 0)) {
      // The endpoint 400s without a password; surface the requirement before
      // any request is made, exactly like the merge <2-files guard.
      setPhase("error");
      setError({
        title: "A password is required",
        message:
          "Protect encrypts the document with the password you set. Enter one in the Configure step and run it again.",
      });
      return;
    }
    if (
      tool.id === "watermark" &&
      options.type === "image" &&
      !(options.image instanceof File)
    ) {
      // The endpoint 400s an image watermark without the image part; surface
      // the requirement up front, exactly like the protect-password guard.
      setPhase("error");
      setError({
        title: "Choose a watermark image",
        message:
          "Image watermarks need a JPG or PNG to stamp. Pick one in the Configure step and run it again.",
      });
      return;
    }
    if (tool.id === "merge" && files.length < 2) {
      setPhase("error");
      setError({
        title: "Two PDFs or more are required",
        message:
          "Merging combines at least two documents. Add another PDF — or remove files from the list — and run it again.",
      });
      return;
    }
    if (tool.workspace === "page-picker" && tool.id === "extract-pages") {
      const active = (pagePlan?.selected ?? []).filter(
        (page) => !(pagePlan?.removed ?? []).includes(page),
      );
      if (active.length === 0) {
        setPhase("error");
        setError({
          title: "Select at least one page",
          message: "Pick the pages you want to extract, then run the tool again.",
        });
        return;
      }
    }

    if (!tool.route) {
      setPhase("error");
      setError({
        title: "No backend yet",
        message:
          "This tool does not have a route on the server, so the file cannot be processed.",
      });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("processing");
    setError(null);
    setResult(null);
    setProgress({
      percent: 0,
      label: PROCESS_LABELS[tool.id] ?? `Running ${tool.name}...`,
    });

    try {
      const outcome = await postTool(
        tool.route,
        files,
        buildOptions(),
        controller.signal,
        `${tool.id}-result`,
      );

      if (controller.signal.aborted) return;

      if (outcome.kind === "json") {
        const next = jsonResult(tool.id, outcome.json, tool.name);
        if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
        fileUrlRef.current = next.url ?? null;
        setResult(next);
      } else if (outcome.blob) {
        if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
        const url = URL.createObjectURL(outcome.blob);
        fileUrlRef.current = url;
        setResult({
          fileName: outcome.fileName ?? `${tool.id}-result`,
          blob: outcome.blob,
          url,
          // Only Compress exists to change the size; elsewhere the metric is noise.
          comparable: tool.id === "compress",
          meta: [
            { label: "Output size", value: formatFileSize(outcome.blob.size) },
            {
              label: "Content type",
              value: outcome.blob.type || "application/octet-stream",
            },
          ],
        });
      }

      setProgress({ percent: 100, label: "Complete" });
      setPhase("complete");
    } catch (caught) {
      if (controller.signal.aborted) return;
      const message =
        caught instanceof ToolError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "The request failed.";
      setError(describeError(message));
      setPhase("error");
    } finally {
      abortRef.current = null;
    }
  }, [buildOptions, files, pagePlan, tool]);
  // `files` is listed for the merge guard above.

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase(files.length > 0 ? "configuring" : "empty");
    setProgress({ percent: 0, label: "Working..." });
  }, [files.length]);

  const configure = useMemo(() => {
    if (!tool) return null;
    return (
      <ToolOptionsPanel
        toolId={tool.id}
        options={options}
        onChange={(patch) => setOptions((current) => ({ ...current, ...patch }))}
        pagePlan={pagePlan}
        files={files}
        onFilesChange={setFiles}
        fields={tool.id === "pdf-form-filler" ? (formFields ?? undefined) : undefined}
      />
    );
  }, [options, pagePlan, tool, files, formFields]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-gutter pt-24">
          <p className="text-body-md text-muted-foreground">Loading tool...</p>
        </main>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="min-h-screen bg-background">
        <Seo title="Tool not found" description="This PDF tool does not exist." />
        <SiteHeader />
        <main className="mx-auto flex max-w-5xl flex-col items-start gap-space-md px-gutter pt-24">
          <h1 className="text-headline-lg text-foreground">Tool not found</h1>
          <p className="text-body-md text-muted-foreground">
            There is no tool with the id &quot;{toolId}&quot;.
          </p>
          <Link
            href="/"
            className="rounded-lg bg-primary-container px-space-md py-space-sm text-label-md text-on-primary-container transition-colors hover:bg-primary-container-hover"
          >
            Back to all tools
          </Link>
        </main>
      </div>
    );
  }

  // An implemented tool whose options panel is missing must not call the
  // endpoint with unset defaults.
  const optionsBlocked = tool.status === "implemented" && !hasOptionsPanel(tool.id);

  // The filler must not run until the form has been inspected (the panel is
  // empty before that) and at least one field carries a value — an empty fill
  // would return the document unchanged while claiming to have filled it.
  const formValues = parseFormValues(options.values);
  const filledCount = Object.values(formValues).filter((value) => value !== "" && value !== false).length;
  const formBlocked =
    tool.id === "pdf-form-filler" && (formInspectLoading || formFields === null || filledCount === 0);

  const shared = {
    tool,
    phase,
    files,
    onFiles: (next: File[]) => {
      setFiles(next);
      setPhase("configuring");
      setError(null);
    },
    onReplace: () => reset(),
    onProcess: process,
    processDisabled: optionsBlocked || formBlocked,
    onCancel: cancel,
    progress,
    result,
    error,
    onReset: reset,
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={`${tool.name} — Free Online PDF Tool`}
        description={tool.description}
        path={`/tools/${tool.id}`}
      />
      <SiteHeader />

      <main className="w-full bg-surface-container-lowest pt-16">
        <div className="mx-auto w-full max-w-5xl px-gutter py-space-xl">
          {tool.workspace === "page-picker" ? (
            <PagePickerWorkspace
              {...shared}
              pages={pages}
              pagesLoading={pagesLoading}
              onPlanChange={setPagePlan}
              configure={configure}
            />
          ) : (
            <StepperWorkspace {...shared} configure={configure} />
          )}
        </div>
      </main>
    </div>
  );
}

/** Turn a JSON tool response into a renderable result panel. */
/** Parses the panel's JSON-string `values` draft for the fill-count gate. */
function parseFormValues(raw: unknown): Record<string, string | boolean> {
  if (typeof raw !== "string" || raw.trim() === "") return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string | boolean> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string" || typeof value === "boolean") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function jsonResult(
  toolId: string,
  payload: unknown,
  toolName: string,
): WorkspaceResult {
  const data = (payload ?? {}) as Record<string, unknown>;

  if (toolId === "ai-summarize") {
    const keyPoints = Array.isArray(data.keyPoints) ? (data.keyPoints as string[]) : [];
    const body = [String(data.summary ?? ""), "", ...keyPoints.map((point) => `• ${point}`)]
      .join("\n")
      .trim();
    const download = new Blob([body], { type: "text/markdown" });
    return {
      fileName: "summary.md",
      blob: download,
      url: URL.createObjectURL(download),
      meta: [
        { label: "Pages", value: String(data.pageCount ?? "—") },
        { label: "Words", value: String(data.wordCount ?? "—") },
        { label: "Key points", value: String(keyPoints.length) },
      ],
      bodyLabel: "Summary",
      body,
    };
  }

  if (toolId === "compare") {
    const counts = (data.counts ?? {}) as Record<string, unknown>;
    const body = String(data.report ?? "");
    const download = new Blob([body], { type: "text/markdown" });
    return {
      fileName: String(data.filename ?? "comparison.md"),
      blob: download,
      url: URL.createObjectURL(download),
      meta: [
        { label: "Unchanged", value: String(counts.unchanged ?? "—") },
        { label: "Removed", value: String(counts.removed ?? "—") },
        { label: "Added", value: String(counts.added ?? "—") },
        { label: "Identical", value: data.identical ? "Yes" : "No" },
      ],
      bodyLabel: "Diff report",
      body,
    };
  }

  if (toolId === "translate-pdf") {
    const pages = Array.isArray(data.pages) ? (data.pages as Array<{ num: number; text: string }>) : [];
    const body = String(data.markdown ?? "");
    const download = new Blob([body], { type: "text/markdown" });
    return {
      fileName: `translation-${data.targetLanguage ?? "document"}.md`,
      blob: download,
      url: URL.createObjectURL(download),
      meta: [
        { label: "Pages translated", value: String(pages.length) },
        { label: "Target", value: String(data.targetLanguage ?? "—") },
        { label: "Failed pages", value: String(data.failedPages ?? 0) },
      ],
      bodyLabel: "Translation",
      body: pages.map((page) => page.text).join("\n\n"),
    };
  }

  return {
    fileName: `${toolName} result`,
    meta: [],
    body: JSON.stringify(data, null, 2),
  };
}

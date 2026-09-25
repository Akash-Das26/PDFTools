import { useState, useCallback, useMemo, useRef } from "react";
import { useParams, Link } from "wouter";
import { useListTools, useCreateJob, getListJobsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Sparkles, GitCompare, Download, Copy, Check } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { ToolWorkspace, type WorkspaceStep } from "@/components/workspace/tool-workspace";
import { UploadDropzone } from "@/components/workspace/upload-dropzone";
import { ProcessingPanel, ResultPanel, ErrorPanel } from "@/components/workspace/states";
import { ToolOptionsPanel } from "@/components/tool-options";
import { baseNameOf, type ToolOptionsReport } from "@/components/tool-options/types";
import { toolIcons, defaultToolIcon } from "@/lib/icons";
import { downloadBlob } from "@/lib/file-utils";
import { useToast } from "@/hooks/use-toast";
import { Seo } from "@/components/seo";

type ProcessingState = "idle" | "processing" | "success" | "error";

interface SummaryResult {
  summary: string;
  keyPoints: string[];
  wordCount: number;
  pageCount: number;
}

interface CompareDiffLine {
  type: "equal" | "add" | "remove";
  text: string;
  page: number;
}

interface CompareResult {
  a: { name: string; pages: number; lines: number };
  b: { name: string; pages: number; lines: number };
  identical: boolean;
  large: boolean;
  truncated: boolean;
  counts: { unchanged: number; removed: number; added: number };
  diff: CompareDiffLine[];
  report: string;
  filename: string;
}

const DEFAULT_ACCEPT = ["application/pdf", ".pdf"];

/** Maps server error text to an in-place recovery route when one exists. */
function recoveryFor(message: string): { to: string; label: string } | null {
  if (/password/i.test(message)) return { to: "/tools/unlock", label: "Unlock this file first" };
  if (/repair|damaged|corrupt/i.test(message)) return { to: "/tools/repair", label: "Try Repair PDF" };
  return null;
}

/** Reads the filename the server suggested for the download, if it sent one. */
function filenameFromResponse(response: Response): string | null {
  const header = response.headers.get("content-disposition");
  const match = header ? /filename="?([^";]+)"?/i.exec(header) : null;
  return match?.[1] ?? null;
}

function isAcceptedFile(file: File, accept: string[]): boolean {
  const name = file.name.toLowerCase();
  return accept.some((rule) =>
    rule.startsWith(".") ? name.endsWith(rule.toLowerCase()) : file.type === rule,
  );
}

export default function Tool() {
  const params = useParams();
  const toolId = params.toolId;
  const { data: tools, isLoading: toolsLoading } = useListTools();
  const tool = tools?.find((t) => t.id === toolId);
  const createJob = useCreateJob();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<ProcessingState>("idle");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFilename, setResultFilename] = useState("");
  const [inputSize, setInputSize] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState<ToolOptionsReport | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const accept = useMemo(
    () => (tool?.accept?.length ? tool.accept : DEFAULT_ACCEPT),
    [tool?.accept],
  );
  const baseName = useMemo(() => (files[0] ? baseNameOf(files[0].name) : "document"), [files]);

  const step: WorkspaceStep = state === "success" ? "download" : files.length > 0 ? "configure" : "upload";

  const handleFiles = useCallback(
    (selected: File[]) => {
      if (!tool || selected.length === 0) return;

      const accepted = selected.filter((file) => isAcceptedFile(file, accept));

      if (accepted.length === 0) {
        toast({
          title: "Invalid file type",
          description: `This tool accepts ${accept.join(", ")}.`,
          variant: "destructive",
        });
        return;
      }

      if (accepted.length !== selected.length) {
        toast({
          title: "Some files were skipped",
          description: `Only ${accept.join(", ")} files are accepted.`,
        });
      }

      const next = tool.acceptMultiple ? accepted : [accepted[0]!];
      setFiles(next);
      setState("idle");
      setResultBlob(null);
      setSummaryResult(null);
      setCompareResult(null);
      setErrorMessage("");
      setOptions(null);
    },
    [accept, tool, toast],
  );

  const handleOptionsChange = useCallback((report: ToolOptionsReport) => {
    setOptions(report);
  }, []);

  const handleProcess = async () => {
    if (!tool || files.length === 0) return;

    setState("processing");
    setErrorMessage("");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const formData = new FormData();

      if (tool.acceptMultiple) {
        files.forEach((file) => formData.append("files", file));
      } else {
        formData.append("file", files[0]);
      }

      // Tool-specific fields, produced by the option panel for this tool.
      for (const [key, value] of options?.fields ?? []) formData.append(key, value);
      for (const [key, file] of options?.files ?? []) formData.append(key, file);

      const response = await fetch(`/api/pdf/${toolId}`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        let msg = error;
        try { msg = JSON.parse(error).error ?? error; } catch { /* plain text */ }
        throw new Error(msg || "Processing failed");
      }

      const totalInputSize = files.reduce((sum, f) => sum + f.size, 0);
      setInputSize(totalInputSize);

      // AI summarize returns JSON, not a binary blob
      if (toolId === "ai-summarize") {
        const json = await response.json() as SummaryResult;
        setSummaryResult(json);
        setState("success");
        createJob.mutate(
          { data: { tool: toolId!, originalFilename: files[0]!.name, inputSizeBytes: totalInputSize, outputSizeBytes: 0, status: "completed" } },
          { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() }) }
        );
        toast({ title: "Summary ready!", description: "Your PDF has been analysed." });
        return;
      }

      // Compare returns JSON so the report can be rendered in place.
      if (toolId === "compare") {
        const json = await response.json() as CompareResult;
        setCompareResult(json);
        setState("success");
        createJob.mutate(
          { data: { tool: toolId!, originalFilename: files[0]!.name, inputSizeBytes: totalInputSize, outputSizeBytes: json.report.length, status: "completed" } },
          { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() }) }
        );
        toast({ title: "Comparison ready!", description: "Your PDFs have been compared." });
        return;
      }

      const blob = await response.blob();
      const filename = filenameFromResponse(response) ?? options?.resultName ?? `${baseName}_${toolId}.pdf`;

      setResultBlob(blob);
      setResultFilename(filename);
      setState("success");

      createJob.mutate(
        { data: { tool: toolId!, originalFilename: files[0]!.name, inputSizeBytes: totalInputSize, outputSizeBytes: blob.size, status: "completed" } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() }) }
      );
      toast({ title: "Success!", description: "Your file is ready to download." });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setState("idle");
        toast({ title: "Cancelled", description: "Processing was cancelled." });
        return;
      }
      setState("error");
      const message = error instanceof Error ? error.message : "Processing failed";
      setErrorMessage(message);
      toast({ title: "Processing failed", description: message, variant: "destructive" });
    } finally {
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleReset = () => {
    setFiles([]);
    setState("idle");
    setResultBlob(null);
    setSummaryResult(null);
    setCompareResult(null);
    setErrorMessage("");
    setOptions(null);
  };

  const handleClearFile = () => {
    setFiles([]);
    setState("idle");
    setResultBlob(null);
    setSummaryResult(null);
    setCompareResult(null);
    setOptions(null);
  };

  const handleDownloadReport = () => {
    if (!compareResult) return;
    downloadBlob(
      new Blob([compareResult.report], { type: "text/markdown;charset=utf-8" }),
      compareResult.filename,
    );
  };

  const handleCopySummary = () => {
    if (!summaryResult) return;
    const text = `Summary\n\n${summaryResult.summary}\n\nKey Points\n\n${summaryResult.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (toolsLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Tool not found</h1>
            <Link href="/">
              <Button><ArrowLeft className="w-4 h-4 mr-2" />Back to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const Icon = toolIcons[tool.id] || defaultToolIcon;
  const isAI = toolId === "ai-summarize";
  const optionsReady = options?.ready ?? true;
  const recovery = recoveryFor(errorMessage);

  const stepLabels: [string, string, string] =
    toolId === "compress" ? ["Upload PDF", "Configure Compression", "Download & Export"] : ["Upload", "Configure", "Download"];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Seo
        title={`${tool.name} Online — Free PDF Tool`}
        description={`${tool.description} Process your PDF online with PDF Tools.`}
        path={`/tools/${tool.id}`}
      />
      <Navbar />

      <main className="flex-1 py-10 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors" data-testid="link-back-home">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to all tools
          </Link>

          <ToolWorkspace
            toolName={tool.name}
            toolDescription={tool.description}
            icon={(props) => <Icon {...props} />}
            step={step}
            fileName={files[0]?.name}
            fileSize={files[0]?.size}
            stepLabels={stepLabels}
            upload={<UploadDropzone accept={accept} maxFiles={tool.acceptMultiple ? 20 : 1} onFiles={handleFiles} />}
            configure={
              <div className="bg-card border border-border rounded-xl p-6" data-testid="workspace-options">
                <h3 className="font-semibold mb-4">Options</h3>
                <ToolOptionsPanel
                  toolId={tool.id}
                  file={files[0]!}
                  baseName={baseName}
                  onChange={handleOptionsChange}
                />
              </div>
            }
            overlay={
              <>
                {state === "processing" && (
                  <ProcessingPanel
                    label={isAI ? "Analysing with AI…" : "Processing your file"}
                    detail={toolId === "compress" ? "Optimising streams…" : undefined}
                    onCancel={handleCancel}
                  />
                )}

                {state === "success" && summaryResult && (
                  <div className="space-y-4" data-testid="summary-panel">
                    <div className="bg-card border border-border rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-primary" />
                          <h3 className="font-semibold text-lg">Summary</h3>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {summaryResult.pageCount} page{summaryResult.pageCount !== 1 ? "s" : ""} · {summaryResult.wordCount.toLocaleString()} words
                          </span>
                          <Button variant="outline" size="sm" onClick={handleCopySummary}>
                            {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                            {copied ? "Copied!" : "Copy"}
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/90">{summaryResult.summary}</p>
                    </div>

                    {summaryResult.keyPoints.length > 0 && (
                      <div className="bg-card border border-border rounded-xl p-6">
                        <h3 className="font-semibold mb-4">Key Points</h3>
                        <ul className="space-y-3">
                          {summaryResult.keyPoints.map((point, i) => (
                            <li key={i} className="flex items-start gap-3">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                                {i + 1}
                              </span>
                              <span className="text-sm leading-relaxed text-foreground/90">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Button onClick={handleReset} variant="outline" className="w-full">Summarise Another File</Button>
                  </div>
                )}

                {state === "success" && compareResult && (
                  <div className="space-y-4" data-testid="compare-result">
                    <div className="bg-card border border-border rounded-xl p-6">
                      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <GitCompare className="w-5 h-5 text-primary" />
                          <h3 className="font-semibold text-lg">Comparison</h3>
                        </div>
                        <div className="flex items-center gap-3">
                          {compareResult.identical && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-success-subtle text-success border border-success/20">
                              Identical text
                            </span>
                          )}
                          <Button variant="outline" size="sm" onClick={handleDownloadReport} data-testid="button-download-report">
                            <Download className="w-4 h-4 mr-1" />Download report
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        {([{ label: "A", doc: compareResult.a }, { label: "B", doc: compareResult.b }] as const).map(({ label, doc }) => (
                          <div key={label} className="bg-background border border-border p-4 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Document {label}</p>
                            <p className="font-medium truncate" title={`${doc.name}.pdf`}>{doc.name}.pdf</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {doc.pages} page{doc.pages !== 1 ? "s" : ""} · {doc.lines} text line{doc.lines !== 1 ? "s" : ""}
                            </p>
                          </div>
                        ))}
                      </div>

                      {compareResult.identical ? (
                        <p className="text-sm text-muted-foreground">
                          Both documents contain the same text. There is nothing to show in a diff.
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-3 text-center">
                          {[
                            { label: "Unchanged", value: compareResult.counts.unchanged, tone: "text-muted-foreground" },
                            { label: "Removed", value: compareResult.counts.removed, tone: "text-destructive" },
                            { label: "Added", value: compareResult.counts.added, tone: "text-success" },
                          ].map((stat) => (
                            <div key={stat.label} className="bg-background border border-border p-4 rounded-lg">
                              <p className={`text-2xl font-bold ${stat.tone}`} data-testid={`compare-count-${stat.label.toLowerCase()}`}>
                                {stat.value.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {compareResult.large && (
                        <p className="text-xs text-muted-foreground mt-4">
                          These documents are large, so differences are listed without their original ordering.
                        </p>
                      )}
                    </div>

                    {!compareResult.identical && (
                      <div className="bg-card border border-border rounded-xl p-6">
                        <h3 className="font-semibold mb-3">Differences (A → B)</h3>
                        <div className="max-h-[28rem] overflow-auto rounded-lg border border-border bg-background" data-testid="compare-diff">
                          {compareResult.diff.map((line, index) => {
                            const marker = line.type === "add" ? "+" : line.type === "remove" ? "−" : " ";
                            return (
                              <div
                                key={index}
                                className={`flex gap-3 px-3 py-0.5 font-mono text-xs leading-relaxed ${
                                  line.type === "add"
                                    ? "bg-success-subtle text-success"
                                    : line.type === "remove"
                                      ? "bg-destructive/10 text-destructive"
                                      : "text-muted-foreground"
                                }`}
                              >
                                <span className="w-3 shrink-0 select-none opacity-70">{marker}</span>
                                <span className="whitespace-pre-wrap break-words flex-1">{line.text}</span>
                                {line.type !== "equal" && <span className="shrink-0 opacity-60">p.{line.page}</span>}
                              </div>
                            );
                          })}
                        </div>
                        {compareResult.truncated && (
                          <p className="text-xs text-muted-foreground mt-3">
                            Showing the first {compareResult.diff.length.toLocaleString()} diff lines. Download the report for the full summary.
                          </p>
                        )}
                      </div>
                    )}

                    <Button onClick={handleReset} variant="outline" className="w-full" data-testid="button-compare-another">
                      Compare Other Files
                    </Button>
                  </div>
                )}

                {state === "success" && resultBlob && !summaryResult && !compareResult && (
                  <ResultPanel
                    blob={resultBlob}
                    filename={resultFilename}
                    inputSize={inputSize}
                    onReset={handleReset}
                  />
                )}

                {state === "error" && (
                  <ErrorPanel
                    title="Processing failed"
                    message={errorMessage}
                    recoverTo={recovery?.to}
                    recoverLabel={recovery?.label}
                    onReset={handleClearFile}
                  />
                )}
              </>
            }
            actionLabel={isAI ? "Summarize with AI" : `Process ${tool.outputLabel}`}
            onAction={handleProcess}
            actionDisabled={state === "processing" || !optionsReady}
            onReplace={handleClearFile}
            onClear={handleClearFile}
          />
        </div>
      </main>

      <footer className="w-full border-t border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} PDF Tools. All files are deleted after processing.
          </p>
        </div>
      </footer>
    </div>
  );
}

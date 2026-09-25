import { useState, useRef, useCallback, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useListTools, useCreateJob, getListJobsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Upload,
  X,
  Loader2,
  CheckCircle2,
  Download,
  ArrowLeft,
  AlertCircle,
  Sparkles,
  GitCompare,
  Copy,
  Check,
} from "lucide-react";
import { toolIcons, defaultToolIcon } from "@/lib/icons";
import { formatFileSize, downloadBlob } from "@/lib/file-utils";
import { useToast } from "@/hooks/use-toast";
import { Seo } from "@/components/seo";
import { ToolOptionsPanel } from "@/components/tool-options";
import { baseNameOf, type ToolOptionsReport } from "@/components/tool-options/types";

type ProcessingState = "idle" | "uploading" | "processing" | "success" | "error";

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
  const [isDragging, setIsDragging] = useState(false);
  const [state, setState] = useState<ProcessingState>("idle");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFilename, setResultFilename] = useState("");
  const [inputSize, setInputSize] = useState(0);
  const [outputSize, setOutputSize] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState<ToolOptionsReport | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const accept = useMemo(
    () => (tool?.accept?.length ? tool.accept : DEFAULT_ACCEPT),
    [tool?.accept],
  );
  const baseName = useMemo(() => (files[0] ? baseNameOf(files[0].name) : "document"), [files]);

  const handleFileSelect = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles || !tool) return;

      const fileArray = Array.from(selectedFiles);
      const accepted = fileArray.filter((file) => isAcceptedFile(file, accept));

      if (accepted.length === 0) {
        toast({
          title: "Invalid file type",
          description: `This tool accepts ${accept.join(", ")}.`,
          variant: "destructive",
        });
        return;
      }

      if (accepted.length !== fileArray.length) {
        toast({
          title: "Some files were skipped",
          description: `Only ${accept.join(", ")} files are accepted.`,
        });
      }

      if (!tool.acceptMultiple && accepted.length > 1) {
        toast({
          title: "Single file only",
          description: `${tool.name} accepts only one file at a time.`,
          variant: "destructive",
        });
        setFiles([accepted[0]!]);
      } else {
        setFiles(tool.acceptMultiple ? accepted : [accepted[0]!]);
      }

      setState("idle");
      setResultBlob(null);
      setSummaryResult(null);
      setCompareResult(null);
    },
    [accept, tool, toast],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleOptionsChange = useCallback((report: ToolOptionsReport) => {
    setOptions(report);
  }, []);

  const handleProcess = async () => {
    if (!tool || files.length === 0) return;

    setState("processing");
    setErrorMessage("");

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
      });

      if (!response.ok) {
        const error = await response.text();
        let msg = error;
        try { msg = JSON.parse(error).error ?? error; } catch { /* fine */ }
        throw new Error(msg || "Processing failed");
      }

      const totalInputSize = files.reduce((sum, f) => sum + f.size, 0);
      setInputSize(totalInputSize);

      // AI summarize returns JSON, not a binary blob
      if (toolId === "ai-summarize") {
        const json = await response.json() as SummaryResult;
        setSummaryResult(json);
        setOutputSize(0);
        setState("success");

        createJob.mutate(
          { data: { tool: toolId!, originalFilename: files[0]!.name, inputSizeBytes: totalInputSize, outputSizeBytes: 0, status: "completed" } },
          { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() }) }
        );
        toast({ title: "Summary ready!", description: "Your PDF has been analysed." });
        return;
      }

      // Compare returns JSON so the report can be rendered here rather than
      // only offered as a download.
      if (toolId === "compare") {
        const json = await response.json() as CompareResult;
        setCompareResult(json);
        setOutputSize(json.report.length);
        setState("success");

        createJob.mutate(
          { data: { tool: toolId!, originalFilename: files[0]!.name, inputSizeBytes: totalInputSize, outputSizeBytes: json.report.length, status: "completed" } },
          { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() }) }
        );
        toast({ title: "Comparison ready!", description: "Your PDFs have been compared." });
        return;
      }

      const blob = await response.blob();
      setResultBlob(blob);
      setOutputSize(blob.size);

      const filename =
        filenameFromResponse(response) ?? options?.resultName ?? `${baseName}_${toolId}.pdf`;

      setResultFilename(filename);
      setState("success");
      downloadBlob(blob, filename);

      createJob.mutate(
        { data: { tool: toolId!, originalFilename: files[0]!.name, inputSizeBytes: totalInputSize, outputSizeBytes: blob.size, status: "completed" } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() }) }
      );
      toast({ title: "Success!", description: "Your file has been processed and downloaded." });
    } catch (error) {
      setState("error");
      const message = error instanceof Error ? error.message : "Processing failed";
      setErrorMessage(message);
      toast({ title: "Processing failed", description: message, variant: "destructive" });
    }
  };

  const handleDownloadAgain = () => {
    if (resultBlob && resultFilename) downloadBlob(resultBlob, resultFilename);
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
  const acceptsImages = accept.some((rule) => rule.startsWith("image/") || /\.(jpe?g|png)$/i.test(rule));

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Seo
        title={`${tool.name} Online — Free PDF Tool`}
        description={`${tool.description} Process your PDF online with PDF Tools.`}
        path={`/tools/${tool.id}`}
      />
      <Navbar />

      <main className="flex-1 py-12 px-4 md:px-6">
        <div className="container max-w-4xl mx-auto">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors" data-testid="link-back-home">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to all tools
          </Link>

          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${tool.color}18` }}
              >
                <Icon className="w-7 h-7" style={{ color: tool.color }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold" data-testid="text-tool-name">{tool.name}</h1>
                  {isAI && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      FREE
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">{tool.description}</p>
              </div>
            </div>
          </div>

          {/* Upload Zone */}
          {files.length === 0 && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
                isDragging ? "border-accent bg-accent/5 animate-pulse-border" : "border-border hover:border-accent/50"
              }`}
              data-testid="upload-zone"
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">{tool.inputLabel}</h3>
              <p className="text-sm text-muted-foreground mb-6">
                {tool.acceptMultiple
                  ? `Drag and drop your ${acceptsImages ? "images" : "PDF files"} here, or click to browse`
                  : `Drag and drop a ${acceptsImages ? "file" : "PDF file"} here, or click to browse`}
              </p>
              <Button onClick={() => fileInputRef.current?.click()} data-testid="button-browse-files">
                Browse Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={accept.join(",")}
                multiple={tool.acceptMultiple}
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
                data-testid="input-file"
              />
            </div>
          )}

          {/* File List + Options */}
          {files.length > 0 && state !== "success" && (
            <div className="space-y-6">
              <div className="bg-card border border-card-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Selected Files</h3>
                  <Button variant="ghost" size="sm" onClick={handleReset} data-testid="button-clear-files">Clear All</Button>
                </div>
                <div className="space-y-2">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded" data-testid={`file-item-${idx}`}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Icon className="w-5 h-5 flex-shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const remaining = files.filter((_, i) => i !== idx);
                          setFiles(remaining);
                          if (remaining.length === 0) setOptions(null);
                        }}
                        data-testid={`button-remove-file-${idx}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tool Options */}
              <div className="bg-card border border-card-border rounded-lg p-6">
                <h3 className="font-semibold mb-4">Options</h3>
                <ToolOptionsPanel
                  toolId={tool.id}
                  file={files[0]!}
                  baseName={baseName}
                  onChange={handleOptionsChange}
                />
              </div>

              {/* Process Button */}
              <Button
                onClick={handleProcess}
                disabled={state === "processing" || !optionsReady}
                className="w-full"
                size="lg"
                data-testid="button-process"
              >
                {state === "processing" ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {isAI ? "Analysing with AI…" : "Processing…"}
                  </>
                ) : (
                  <>
                    {isAI && <Sparkles className="w-4 h-4 mr-2" />}
                    Process {tool.outputLabel}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Success — AI Summary */}
          {state === "success" && summaryResult && (
            <div className="space-y-4">
              <div className="bg-card border border-card-border rounded-lg p-6">
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
                <div className="bg-card border border-card-border rounded-lg p-6">
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

              <div className="flex gap-3">
                <Button onClick={handleReset} variant="outline" className="flex-1">Summarise Another File</Button>
              </div>
            </div>
          )}

          {/* Success — PDF comparison */}
          {state === "success" && compareResult && (
            <div className="space-y-4">
              <div className="bg-card border border-card-border rounded-lg p-6" data-testid="compare-result">
                <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <GitCompare className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-lg">Comparison</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    {compareResult.identical && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
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
                    <div key={label} className="bg-muted/50 p-4 rounded">
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
                      { label: "Removed", value: compareResult.counts.removed, tone: "text-red-600 dark:text-red-400" },
                      { label: "Added", value: compareResult.counts.added, tone: "text-green-600 dark:text-green-400" },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-muted/50 p-4 rounded">
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
                <div className="bg-card border border-card-border rounded-lg p-6">
                  <h3 className="font-semibold mb-3">Differences (A → B)</h3>
                  <div className="max-h-[28rem] overflow-auto rounded border border-border bg-muted/30" data-testid="compare-diff">
                    {compareResult.diff.map((line, index) => {
                      const marker = line.type === "add" ? "+" : line.type === "remove" ? "−" : " ";
                      return (
                        <div
                          key={index}
                          className={`flex gap-3 px-3 py-0.5 font-mono text-xs leading-relaxed ${
                            line.type === "add"
                              ? "bg-green-500/10 text-green-700 dark:text-green-300"
                              : line.type === "remove"
                                ? "bg-red-500/10 text-red-700 dark:text-red-300"
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

          {/* Success — File Download */}
          {state === "success" && resultBlob && !summaryResult && (
            <div className="bg-card border border-card-border rounded-lg p-8 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-600 dark:text-green-500" />
              <h3 className="text-2xl font-bold mb-2">Success!</h3>
              <p className="text-muted-foreground mb-6">
                Your file has been processed and downloaded as <span className="font-medium text-foreground">{resultFilename}</span>.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-6 max-w-md mx-auto">
                <div className="bg-muted/50 p-4 rounded">
                  <p className="text-xs text-muted-foreground mb-1">Original Size</p>
                  <p className="font-semibold" data-testid="text-original-size">{formatFileSize(inputSize)}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded">
                  <p className="text-xs text-muted-foreground mb-1">Processed Size</p>
                  <p className="font-semibold" data-testid="text-processed-size">{formatFileSize(outputSize)}</p>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <Button onClick={handleDownloadAgain} variant="default" data-testid="button-download-again">
                  <Download className="w-4 h-4 mr-2" />Download Again
                </Button>
                <Button onClick={handleReset} variant="outline" data-testid="button-process-another">Process Another File</Button>
              </div>
            </div>
          )}

          {/* Error State */}
          {state === "error" && (
            <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-8 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
              <h3 className="text-2xl font-bold mb-2">Processing Failed</h3>
              <p className="text-muted-foreground mb-6">{errorMessage}</p>
              <Button onClick={handleReset} data-testid="button-try-again">Try Again</Button>
            </div>
          )}
        </div>
      </main>

      <footer className="w-full border-t border-border">
        <div className="container px-4 md:px-6 py-8">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} PDF Tools. All files are deleted after processing.
          </p>
        </div>
      </footer>
    </div>
  );
}

import { useState, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useListTools, useCreateJob, getListJobsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  Upload,
  X,
  FileText,
  Loader2,
  CheckCircle2,
  Download,
  ArrowLeft,
  AlertCircle,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { toolIcons } from "@/lib/icons";
import { formatFileSize, downloadBlob } from "@/lib/file-utils";
import { useToast } from "@/hooks/use-toast";
import { Seo } from "@/components/seo";

type ProcessingState = "idle" | "uploading" | "processing" | "success" | "error";

interface SummaryResult {
  summary: string;
  keyPoints: string[];
  wordCount: number;
  pageCount: number;
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
  const [copied, setCopied] = useState(false);

  // Tool-specific options
  const [quality, setQuality] = useState<"extreme" | "recommended" | "high">("recommended");
  const [rotation, setRotation] = useState<90 | 180 | 270>(90);
  const [splitType, setSplitType] = useState<"all" | "pages">("all");
  const [pages, setPages] = useState("");
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkOpacity, setWatermarkOpacity] = useState([0.3]);
  const [watermarkPosition, setWatermarkPosition] = useState<"center" | "diagonal">("diagonal");
  const [password, setPassword] = useState("");
  const [pageNumPosition, setPageNumPosition] = useState<string>("bottom-center");
  const [pageNumStart, setPageNumStart] = useState("1");
  const [pageNumFormat, setPageNumFormat] = useState<"1" | "Page 1" | "1/N">("1");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles || !tool) return;

      const fileArray = Array.from(selectedFiles).filter(
        (f) => f.type === "application/pdf"
      );

      if (fileArray.length === 0) {
        toast({
          title: "Invalid file type",
          description: "Please upload PDF files only.",
          variant: "destructive",
        });
        return;
      }

      if (!tool.acceptMultiple && fileArray.length > 1) {
        toast({
          title: "Single file only",
          description: `${tool.name} accepts only one file at a time.`,
          variant: "destructive",
        });
        setFiles([fileArray[0]]);
      } else {
        setFiles(tool.acceptMultiple ? fileArray : [fileArray[0]]);
      }

      setState("idle");
      setResultBlob(null);
      setSummaryResult(null);
    },
    [tool, toast]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

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

      // Tool-specific options
      if (toolId === "compress") {
        formData.append("quality", quality);
      } else if (toolId === "rotate") {
        formData.append("rotation", rotation.toString());
      } else if (toolId === "split") {
        formData.append("splitType", splitType);
        if (splitType === "pages") formData.append("pages", pages);
      } else if (toolId === "watermark") {
        formData.append("text", watermarkText);
        formData.append("opacity", watermarkOpacity[0].toString());
        formData.append("position", watermarkPosition);
      } else if (toolId === "protect") {
        formData.append("password", password);
      } else if (toolId === "add-page-numbers") {
        formData.append("position", pageNumPosition);
        formData.append("startNumber", pageNumStart);
        formData.append("format", pageNumFormat);
      }

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

      const blob = await response.blob();
      setResultBlob(blob);
      setOutputSize(blob.size);

      const baseName = files[0].name.replace(/\.pdf$/i, "");
      let filename = `${baseName}_${toolId}.pdf`;
      if (toolId === "merge") filename = `${baseName}_merged.pdf`;
      else if (toolId === "split" && splitType === "all") filename = `${baseName}_split.zip`;
      else if (toolId === "rotate") filename = `${baseName}_rotated.pdf`;
      else if (toolId === "add-page-numbers") filename = `${baseName}_numbered.pdf`;
      else if (toolId === "extract-text") filename = `${baseName}.txt`;

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
    setErrorMessage("");
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

  const Icon = toolIcons[tool.id] || FileText;
  const isAI = toolId === "ai-summarize";

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
                  ? "Drag and drop PDF files here, or click to browse"
                  : "Drag and drop a PDF file here, or click to browse"}
              </p>
              <Button onClick={() => fileInputRef.current?.click()} data-testid="button-browse-files">
                Browse Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
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
                        <FileText className="w-5 h-5 flex-shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setFiles(files.filter((_, i) => i !== idx))} data-testid={`button-remove-file-${idx}`}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tool Options */}
              <div className="bg-card border border-card-border rounded-lg p-6">
                <h3 className="font-semibold mb-4">Options</h3>

                {toolId === "compress" && (
                  <div>
                    <Label className="mb-3 block">Compression Quality</Label>
                    <RadioGroup value={quality} onValueChange={(v) => setQuality(v as typeof quality)}>
                      <div className="flex items-center space-x-2 mb-2"><RadioGroupItem value="extreme" id="extreme" /><Label htmlFor="extreme" className="font-normal cursor-pointer">Extreme (smallest file)</Label></div>
                      <div className="flex items-center space-x-2 mb-2"><RadioGroupItem value="recommended" id="recommended" /><Label htmlFor="recommended" className="font-normal cursor-pointer">Recommended (balanced)</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="high" id="high" /><Label htmlFor="high" className="font-normal cursor-pointer">High Quality (larger file)</Label></div>
                    </RadioGroup>
                  </div>
                )}

                {toolId === "rotate" && (
                  <div>
                    <Label className="mb-3 block">Rotation Angle</Label>
                    <RadioGroup value={rotation.toString()} onValueChange={(v) => setRotation(Number(v) as typeof rotation)}>
                      <div className="flex items-center space-x-2 mb-2"><RadioGroupItem value="90" id="r90" /><Label htmlFor="r90" className="font-normal cursor-pointer">90° Clockwise</Label></div>
                      <div className="flex items-center space-x-2 mb-2"><RadioGroupItem value="180" id="r180" /><Label htmlFor="r180" className="font-normal cursor-pointer">180°</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="270" id="r270" /><Label htmlFor="r270" className="font-normal cursor-pointer">270° Clockwise</Label></div>
                    </RadioGroup>
                  </div>
                )}

                {toolId === "split" && (
                  <div>
                    <Label className="mb-3 block">Split Mode</Label>
                    <RadioGroup value={splitType} onValueChange={(v) => setSplitType(v as typeof splitType)}>
                      <div className="flex items-center space-x-2 mb-2"><RadioGroupItem value="all" id="all" /><Label htmlFor="all" className="font-normal cursor-pointer">Split into individual pages</Label></div>
                      <div className="flex items-center space-x-2 mb-3"><RadioGroupItem value="pages" id="pages" /><Label htmlFor="pages" className="font-normal cursor-pointer">Extract specific pages</Label></div>
                    </RadioGroup>
                    {splitType === "pages" && (
                      <div className="mt-3">
                        <Label htmlFor="pages-input" className="mb-2 block text-sm">Page Numbers (comma-separated)</Label>
                        <Input id="pages-input" placeholder="e.g., 1,3,5" value={pages} onChange={(e) => setPages(e.target.value)} data-testid="input-pages" />
                      </div>
                    )}
                  </div>
                )}

                {toolId === "watermark" && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="watermark-text" className="mb-2 block">Watermark Text</Label>
                      <Input id="watermark-text" placeholder="Enter watermark text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} data-testid="input-watermark-text" />
                    </div>
                    <div>
                      <Label className="mb-2 block">Opacity: {(watermarkOpacity[0] * 100).toFixed(0)}%</Label>
                      <Slider value={watermarkOpacity} onValueChange={setWatermarkOpacity} min={0.1} max={1} step={0.1} />
                    </div>
                    <div>
                      <Label className="mb-3 block">Position</Label>
                      <RadioGroup value={watermarkPosition} onValueChange={(v) => setWatermarkPosition(v as typeof watermarkPosition)}>
                        <div className="flex items-center space-x-2 mb-2"><RadioGroupItem value="center" id="wm-center" /><Label htmlFor="wm-center" className="font-normal cursor-pointer">Center</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="diagonal" id="wm-diagonal" /><Label htmlFor="wm-diagonal" className="font-normal cursor-pointer">Diagonal</Label></div>
                      </RadioGroup>
                    </div>
                  </div>
                )}

                {toolId === "protect" && (
                  <div>
                    <Label htmlFor="password" className="mb-2 block">Password</Label>
                    <Input id="password" type="password" placeholder="Enter password to protect PDF" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-password" />
                  </div>
                )}

                {toolId === "add-page-numbers" && (
                  <div className="space-y-5">
                    <div>
                      <Label className="mb-3 block">Position</Label>
                      <RadioGroup value={pageNumPosition} onValueChange={setPageNumPosition}>
                        {[
                          { value: "bottom-center", label: "Bottom Center" },
                          { value: "bottom-right", label: "Bottom Right" },
                          { value: "bottom-left", label: "Bottom Left" },
                          { value: "top-center", label: "Top Center" },
                          { value: "top-right", label: "Top Right" },
                        ].map(({ value, label }) => (
                          <div key={value} className="flex items-center space-x-2 mb-2">
                            <RadioGroupItem value={value} id={`pn-${value}`} />
                            <Label htmlFor={`pn-${value}`} className="font-normal cursor-pointer">{label}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="pn-start" className="mb-2 block">Starting Number</Label>
                        <Input id="pn-start" type="number" min="1" value={pageNumStart} onChange={(e) => setPageNumStart(e.target.value)} placeholder="1" />
                      </div>
                      <div>
                        <Label className="mb-3 block">Format</Label>
                        <RadioGroup value={pageNumFormat} onValueChange={(v) => setPageNumFormat(v as typeof pageNumFormat)}>
                          {(["1", "Page 1", "1/N"] as const).map((f) => (
                            <div key={f} className="flex items-center space-x-2 mb-1">
                              <RadioGroupItem value={f} id={`pnf-${f}`} />
                              <Label htmlFor={`pnf-${f}`} className="font-normal cursor-pointer font-mono text-sm">{f}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    </div>
                  </div>
                )}

                {toolId === "merge" && (
                  <p className="text-sm text-muted-foreground">Files will be merged in the order shown above.</p>
                )}

                {(toolId === "extract-text" || toolId === "ai-summarize") && (
                  <p className="text-sm text-muted-foreground">
                    {toolId === "extract-text"
                      ? "All readable text will be extracted and saved as a .txt file."
                      : "AI will read the document and produce a concise summary with key takeaways."}
                  </p>
                )}
              </div>

              {/* Process Button */}
              <Button
                onClick={handleProcess}
                disabled={
                  state === "processing" ||
                  (toolId === "watermark" && !watermarkText) ||
                  (toolId === "protect" && !password) ||
                  (toolId === "split" && splitType === "pages" && !pages)
                }
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

          {/* Success — File Download */}
          {state === "success" && resultBlob && !summaryResult && (
            <div className="bg-card border border-card-border rounded-lg p-8 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-600 dark:text-green-500" />
              <h3 className="text-2xl font-bold mb-2">Success!</h3>
              <p className="text-muted-foreground mb-6">Your file has been processed and downloaded.</p>

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

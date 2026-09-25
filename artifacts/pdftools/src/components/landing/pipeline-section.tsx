import { useToolCatalog } from "@/lib/tool-catalog";
import { uiIcons } from "@/lib/icons";

/**
 * Pipeline / architecture section.
 *
 * IMPORTANT — copy divergence: the reference version of this band is titled
 * "Engineered for absolute document sovereignty" and reports "0ms Server Upload
 * Latency", "0 B Data Stored Remotely", "100% Offline Capable", a "Client
 * WebAssembly Runtime" and a "3.8 GB/s Memory Buffer Bandwidth" read-out. Every
 * one of those is false here — requests go to an Express document service and
 * there is no WASM pipeline — so the fabricated metrics and the telemetry graph
 * are dropped rather than reproduced. What replaces them is checkable: the real
 * catalog size and the real upload limits. Flagged for sign-off.
 */
const STEPS = [
  {
    icon: uiIcons.folderOpen,
    tint: "text-muted-foreground",
    label: "1. File received into memory",
    detail: "multer buffer",
  },
  {
    icon: uiIcons.sliders,
    tint: "text-primary",
    label: "2. Document engine processes it",
    detail: "pdf-lib · tesseract",
  },
  {
    icon: uiIcons.download,
    tint: "text-tertiary",
    label: "3. Result streamed back to you",
    detail: "instant save",
  },
];

export function PipelineSection() {
  const { tools } = useToolCatalog();

  const stats = [
    { value: "50 MB", label: "Maximum file size" },
    { value: "20", label: "Files per multi-file job" },
    { value: String(tools.length || 32), label: "Tools in the catalog" },
  ];

  return (
    <section className="w-full bg-surface-container-low py-margin-lg">
      <div className="mx-auto max-w-7xl px-gutter">
        <div className="flex flex-col items-start justify-between gap-space-xl lg:flex-row">
          <div className="flex max-w-md flex-col gap-space-sm">
            <div className="text-label-sm font-semibold uppercase tracking-wider text-primary">
              One shape, every tool
            </div>
            <h3 className="text-headline-lg tracking-tight text-foreground">
              Upload, configure, download — nothing else to learn
            </h3>
            <p className="text-body-md text-muted-foreground">
              All {tools.length || 32} tools reuse the same three-step
              workspace, so learning one teaches you the rest. Files are sent to
              the document service, processed, and returned to you.
            </p>

            <div className="flex items-center gap-space-lg pt-space-md">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <div className="text-headline-lg font-bold text-foreground">
                    {stat.value}
                  </div>
                  <div className="text-body-sm text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex w-full flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-level-2 lg:max-w-xl">
            <div className="flex items-center justify-between">
              <span className="text-label-sm font-semibold uppercase text-muted-foreground">
                Job lifecycle
              </span>
              <span className="flex items-center gap-1 text-code-sm text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Not persisted
              </span>
            </div>

            <div className="space-y-space-sm">
              {STEPS.map((step) => (
                <div
                  key={step.label}
                  className="flex items-center justify-between rounded-lg bg-surface p-space-sm"
                >
                  <div className="flex items-center gap-space-sm">
                    <step.icon className={`h-[18px] w-[18px] ${step.tint}`} />
                    <span className="text-body-sm font-medium text-foreground">
                      {step.label}
                    </span>
                  </div>
                  <span className="text-code-sm text-muted-foreground">
                    {step.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

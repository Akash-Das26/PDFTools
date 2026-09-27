import type { LucideIcon } from "lucide-react";
import { Archive, Lock, Zap } from "lucide-react";

/**
 * Value-assurance strip.
 *
 * IMPORTANT — copy divergence: the reference's three claims
 * ("Client-Side Architecture / processed in browser memory via WASM",
 * "Zero File Size Quotas / 500MB+", "Strict ISO Compliance") describe a
 * browser-only product. This app is not that: files are POSTed to the
 * document service, which enforces 50 MB per file and 20 files per request.
 * Shipping those claims would put false statements in the UI, so each one is
 * replaced with a statement that matches the running code (see the limits in
 * `artifacts/api-server/src/lib/upload.ts`). Flagged for sign-off.
 */
const HIGHLIGHTS: Array<{
  icon: LucideIcon;
  tint: string;
  title: string;
  description: string;
}> = [
  {
    icon: Lock,
    tint: "text-primary",
    title: "Processed in memory",
    description: "Uploads are held in memory only while your job runs and are never written to durable storage.",
  },
  {
    icon: Zap,
    tint: "text-secondary",
    title: "50 MB per file",
    description: "Up to 20 files in a single job — no paywall, no signup, no watermark.",
  },
  {
    icon: Archive,
    tint: "text-tertiary",
    title: "Archival output",
    description: "PDF/A conversion writes ISO 19005-compliant files for long-term storage.",
  },
];

export function ValueStrip() {
  return (
    <div className="mx-auto mt-space-xl max-w-7xl px-gutter">
      <div className="grid grid-cols-1 gap-space-md rounded-xl bg-surface-container-low p-space-md shadow-level-2 md:grid-cols-3">
        {HIGHLIGHTS.map((item) => (
          <div key={item.title} className="flex items-center gap-space-sm px-space-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest shadow-level-2">
              <item.icon className={`h-[18px] w-[18px] ${item.tint}`} />
            </div>
            <div>
              <div className="text-headline-sm text-foreground">{item.title}</div>
              <div className="text-body-sm text-muted-foreground">
                {item.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

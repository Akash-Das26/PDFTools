import { useCallback, useEffect, useMemo, useState } from "react";
import { GripVertical, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { OptionField, PageSelectionField } from "./parts";
import { formatPageNumbers, useOptionsReport, type ToolOptionsPanelProps } from "./types";

export function RotateOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const [rotation, setRotation] = useState<"90" | "180" | "270">("90");
  const [pages, setPages] = useState("");

  const report = useMemo(() => {
    const fields: Array<[string, string]> = [["rotation", rotation]];
    if (pages.trim()) fields.push(["pages", pages.trim()]);

    return {
      fields,
      files: [],
      ready: true,
      resultName: `${baseName}_rotated.pdf`,
    };
  }, [baseName, pages, rotation]);
  useOptionsReport(onChange, report);

  return (
    <div className="space-y-5">
      <OptionField label="Rotation angle">
        <RadioGroup value={rotation} onValueChange={(value) => setRotation(value as typeof rotation)}>
          {[
            { value: "90", label: "90° clockwise" },
            { value: "180", label: "180°" },
            { value: "270", label: "270° clockwise" },
          ].map(({ value, label }) => (
            <div key={value} className="flex items-center space-x-2">
              <RadioGroupItem value={value} id={`rotate-${value}`} />
              <Label htmlFor={`rotate-${value}`} className="cursor-pointer font-normal">
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </OptionField>

      <PageSelectionField value={pages} onChange={setPages} id="rotate-pages" />
    </div>
  );
}

export function RemovePagesOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const [pages, setPages] = useState("");

  const report = useMemo(
    () => ({
      fields: [["pages", pages.trim()]] as Array<[string, string]>,
      files: [],
      ready: pages.trim().length > 0,
      resultName: `${baseName}_pages-removed.pdf`,
    }),
    [baseName, pages],
  );
  useOptionsReport(onChange, report);

  return (
    <PageSelectionField
      value={pages}
      onChange={setPages}
      id="remove-pages-input"
      emptyMeansAll={false}
      hint="Comma separated pages or ranges to delete, e.g. 2,4,7-9."
    />
  );
}

interface PageInfoResponse {
  pageCount: number;
  pages: Array<{ number: number; width: number; height: number; rotation: number; thumbnail?: string }>;
  thumbnailsIncluded?: boolean;
}

/**
 * Organise pages: the page list and previews come from the API (browsers cannot
 * render a PDF on their own), then the pages are dragged into the wanted order.
 */
export function ReorderPagesOptions({ file, baseName, onChange }: ToolOptionsPanelProps) {
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [order, setOrder] = useState<number[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setPageCount(null);
    setThumbnails({});
    setError("");

    const body = new FormData();
    body.append("file", file);
    body.append("thumbnails", "true");
    body.append("thumbnailWidth", "140");

    fetch("/api/pdf/page-info", { method: "POST", body })
      .then(async (response) => {
        if (!response.ok) {
          const text = await response.text();
          let message = text;
          try {
            message = (JSON.parse(text) as { error?: string }).error ?? text;
          } catch {
            /* response was not JSON */
          }
          throw new Error(message || "Could not read the page list");
        }
        return (await response.json()) as PageInfoResponse;
      })
      .then((info) => {
        if (cancelled) return;
        setPageCount(info.pageCount);
        setOrder(info.pages.map((page) => page.number));
        setThumbnails(
          Object.fromEntries(
            info.pages
              .filter((page) => Boolean(page.thumbnail))
              .map((page) => [page.number, page.thumbnail as string]),
          ),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not read the page list");
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  const report = useMemo(
    () => ({
      fields: [["order", formatPageNumbers(order)]] as Array<[string, string]>,
      files: [],
      ready: order.length > 0,
      resultName: `${baseName}_reordered.pdf`,
    }),
    [baseName, order],
  );
  useOptionsReport(onChange, report);

  const hasThumbnails = Object.keys(thumbnails).length > 0;

  const move = useCallback((from: number, to: number) => {
    setOrder((current) => {
      if (to < 0 || to >= current.length || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }, []);

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => setOrder([])} disabled>
          Retry by reloading the file
        </Button>
      </div>
    );
  }

  if (pageCount === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Reading the page list…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="block">Page order</Label>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {order.length} of {pageCount} pages kept
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOrder(Array.from({ length: pageCount }, (_, index) => index + 1))}
          >
            <RotateCcw className="mr-1 h-4 w-4" /> Reset
          </Button>
        </div>
      </div>

      <ul className="flex flex-wrap gap-3" data-testid="page-order-list">
        {order.map((pageNumber, index) => {
          const thumbnail = thumbnails[pageNumber];
          return (
            <li
              key={pageNumber}
              draggable
              onDragStart={() => setDragging(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragging !== null) move(dragging, index);
                setDragging(null);
              }}
              onDragEnd={() => setDragging(null)}
              className={`group w-[104px] cursor-grab overflow-hidden rounded-md border bg-card ${
                dragging === index ? "border-accent opacity-60" : "border-card-border"
              }`}
              data-testid={`page-chip-${pageNumber}`}
            >
              <div className="flex h-[138px] items-center justify-center bg-muted/40">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={`Page ${pageNumber} preview`}
                    draggable={false}
                    className="max-h-full max-w-full select-none"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Page {pageNumber}</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 border-t border-card-border px-1.5 py-1">
                <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <span className="flex-1 text-center text-xs font-medium tabular-nums">{pageNumber}</span>
                <button
                  type="button"
                  aria-label={`Remove page ${pageNumber}`}
                  className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setOrder((current) => current.filter((value) => value !== pageNumber))}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {order.length === 0 ? (
        <p className="text-sm text-destructive">Keep at least one page.</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {hasThumbnails
            ? "Drag a page to rearrange it, or remove the ones you don't need. The PDF is rebuilt in this order."
            : "Drag pages to rearrange them, or remove the ones you don't need. Previews are unavailable for documents this long."}
        </p>
      )}
    </div>
  );
}

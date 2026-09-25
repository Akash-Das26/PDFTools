import { uiIcons } from "@/lib/icons";
import { formatFileSize } from "@/lib/file-utils";

/**
 * File summary strip.
 *
 * Mirrors the reference: a 40px tinted PDF tile, the filename, a size chip,
 * page count, and a "Replace document" control on the right.
 *
 * The reference also prints a `SHA-256: 4f8a...9c2e` hash. The server never
 * computes or returns one, so it is omitted rather than faked.
 */
export function FileStrip({
  files,
  pageCount,
  onReplace,
  disabled = false,
}: {
  files: File[];
  pageCount?: number | null;
  onReplace: () => void;
  disabled?: boolean;
}) {
  const [first] = files;
  if (!first) return null;

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const label =
    files.length > 1 ? `${files.length} files` : first.name;

  return (
    <div className="flex w-full flex-col items-start justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-level-2 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-space-md">
        {/* M3 pairing: an `error-container` chip carries `on-error-container`
            text. The previous `text-primary-container` measured 3.74:1. */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-error-container text-on-error-container">
          <uiIcons.upload className="h-[22px] w-[22px]" />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-space-xs">
            <span
              data-testid="file-strip-name"
              className="truncate text-headline-sm text-foreground"
            >
              {label}
            </span>
            <span className="rounded-full bg-surface-container px-space-xs py-0.5 text-code-sm text-on-surface-variant">
              {formatFileSize(totalSize)}
            </span>
          </div>
          {files.length === 1 && (
            <div className="mt-0.5 flex items-center gap-space-sm text-body-sm text-muted-foreground">
              {typeof pageCount === "number" && (
                <>
                  <span>
                    {pageCount} {pageCount === 1 ? "page" : "pages"}
                  </span>
                  <span>•</span>
                </>
              )}
              <span>{first.type || "document"}</span>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        data-testid="button-replace-file"
        disabled={disabled}
        onClick={onReplace}
        className="flex items-center gap-space-xs self-start rounded-lg px-space-sm py-space-xs text-label-sm text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground disabled:pointer-events-none disabled:opacity-50 sm:self-center"
      >
        <uiIcons.rotateCcw className="h-[18px] w-[18px]" />
        <span>Replace document</span>
      </button>
    </div>
  );
}

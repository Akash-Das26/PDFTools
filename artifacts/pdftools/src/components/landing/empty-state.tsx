import { uiIcons } from "@/lib/icons";

/** No-matches state for the tool grid — reference copy, verbatim. */
export function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div
      data-testid="tools-empty"
      className="flex flex-col items-center justify-center py-margin-lg text-center"
    >
      <div className="mb-space-md flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-muted-foreground">
        <uiIcons.search className="h-8 w-8" />
      </div>
      <h3 className="text-headline-md text-foreground">No matching PDF tools found</h3>
      <p className="mt-space-xs max-w-sm text-body-md text-muted-foreground">
        Try searching for keywords like &quot;merge&quot;, &quot;convert&quot;,
        &quot;password&quot;, or &quot;compress&quot;.
      </p>
      <button
        type="button"
        onClick={onReset}
        data-testid="reset-search"
        className="mt-space-md rounded-lg bg-primary px-space-md py-space-xs text-label-md text-on-primary transition-colors hover:bg-primary-hover"
      >
        Clear Search
      </button>
    </div>
  );
}

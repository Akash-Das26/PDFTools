import { useMemo, useState } from "react";
import { Seo } from "@/components/seo";
import { SiteHeader } from "@/components/site-header";
import { SearchDialog } from "@/components/search-dialog";
import { CategoryPills } from "@/components/landing/category-pills";
import { CategorySection } from "@/components/landing/category-section";
import { EmptyState } from "@/components/landing/empty-state";
import { PipelineSection } from "@/components/landing/pipeline-section";
import { QuickDropzone } from "@/components/landing/quick-dropzone";
import { SiteFooter } from "@/components/landing/site-footer";
import { ToolSearchBar } from "@/components/landing/tool-search-bar";
import { ValueStrip } from "@/components/landing/value-strip";
import { CATEGORIES } from "@/lib/tool-categories";
import { filterTools, useToolCatalog } from "@/lib/tool-catalog";

/**
 * Landing / tool grid.
 *
 * Layout follows `landing_tool_grid_categorized_sections`: an ambient two-tone
 * glow behind a centred hero, the quick-dropzone launcher, the search bar with
 * its filter pills, then the six categorized sections in reference order, then
 * the value strip and pipeline band.
 *
 * Search and the category pills are independent filters that compose, and both
 * read the live catalog — so a section's count badge always equals the number
 * of cards actually rendered beneath it.
 */
export default function Home() {
  const { tools, isLoading, isError } = useToolCatalog();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [paletteOpen, setPaletteOpen] = useState(false);

  const searched = useMemo(() => filterTools(tools, query), [tools, query]);

  const visibleCategories = useMemo(
    () => CATEGORIES.filter((category) => filter === "all" || category.id === filter),
    [filter],
  );

  const hasResults = visibleCategories.some((category) =>
    searched.some((tool) => tool.category === category.id),
  );

  const reset = () => {
    setQuery("");
    setFilter("all");
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Free PDF Tools Online: Merge, Compress, Split, Convert & More"
        description="Fast, free online PDF tools for merging, splitting, compressing, converting, protecting and summarizing documents. No signup, no watermarks."
        path="/"
      />
      <SiteHeader />

      <main className="w-full bg-surface-container-lowest pt-16">
        <div className="relative w-full overflow-hidden pb-margin-lg">
          {/* Ambient glow geometry */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-96 w-3/4 max-w-5xl -translate-x-1/2 bg-gradient-to-b from-primary/5 via-secondary/5 to-transparent blur-3xl"
          />

          <section className="mx-auto flex max-w-7xl flex-col items-center px-gutter pt-space-xl text-center sm:pt-margin-lg">
            <div className="mb-space-lg inline-flex items-center gap-space-xs rounded-full bg-surface-container px-space-md py-1 shadow-level-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">
                Open-Source &amp; Privacy-First PDF Toolkit
              </span>
            </div>

            <h1 className="max-w-4xl text-headline-xl-mobile tracking-tight text-foreground sm:text-headline-xl">
              Every tool you need to work with PDFs in one place
            </h1>

            <p className="mt-space-md max-w-2xl text-body-lg text-muted-foreground">
              Fast, secure utilities that all follow the same three steps. No
              subscription hurdles, no watermarks, no signup.
            </p>

            <QuickDropzone />

            <div className="mt-space-xl flex w-full max-w-4xl flex-col items-center gap-space-md">
              <ToolSearchBar
                value={query}
                onChange={setQuery}
                onOpenPalette={() => setPaletteOpen(true)}
              />
              <CategoryPills active={filter} onChange={setFilter} />
            </div>
          </section>

          <ValueStrip />

          <div
            id="tools-container"
            className="mx-auto mb-margin-lg flex w-full max-w-7xl flex-col gap-margin-lg px-gutter pt-margin-lg"
          >
            {isLoading && (
              <p className="py-margin-lg text-center text-body-md text-muted-foreground">
                Loading tools...
              </p>
            )}

            {isError && (
              <p className="py-margin-lg text-center text-body-md text-destructive">
                Could not load the tool catalog. Please refresh.
              </p>
            )}

            {!isLoading && !isError && !hasResults && (
              <EmptyState onReset={reset} />
            )}

            {!isLoading &&
              !isError &&
              visibleCategories.map((category) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  tools={searched}
                />
              ))}
          </div>
        </div>

        <PipelineSection />
      </main>

      <SiteFooter />
      <SearchDialog open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

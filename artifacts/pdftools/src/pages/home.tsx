import { useMemo, useState } from "react";
import { useListTools } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Navbar } from "@/components/navbar";
import { ToolCard } from "@/components/tool-card";
import { ToolSearch } from "@/components/tool-search";
import { CategorySection } from "@/components/category-section";
import { toolIcons, defaultToolIcon } from "@/lib/icons";
import { TOOL_CATEGORY_GROUPS, toneForCategory } from "@/lib/tool-categories";
import { Seo } from "@/components/seo";
import { FileSearch } from "lucide-react";

export default function Home() {
  const { data: tools, isLoading } = useListTools();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOOL_CATEGORY_GROUPS.map((meta) => {
      const inGroup = (tools ?? []).filter((tool) => meta.matches.includes(tool.category));
      const matched = inGroup.filter((tool) => {
        const haystack = `${tool.name} ${tool.description}`.toLowerCase();
        return (!q || haystack.includes(q)) && (filter === "all" || filter === meta.filter);
      });
      return { meta, tools: matched, total: inGroup.length };
    }).filter((group) => group.tools.length > 0);
  }, [tools, query, filter]);

  const isEmpty = !isLoading && visibleGroups.length === 0;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Seo
        title="Free PDF Tools Online: Merge, Compress, Summarize & More"
        description="Fast, free online PDF tools for merging, splitting, compressing, protecting, summarizing, extracting text, and numbering pages."
        path="/"
      />
      <Navbar />

      {/* Hero */}
      <section className="relative w-full overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 max-w-5xl h-96 bg-gradient-to-b from-primary/5 via-secondary/5 to-transparent blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 md:px-6 pt-12 sm:pt-16 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-card border border-border shadow-xs mb-6 transition-transform hover:scale-[1.02] cursor-default">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs tracking-wide uppercase font-semibold text-muted-foreground">
              Open-source &amp; privacy-first PDF toolkit
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight max-w-4xl leading-tight">
            Every tool you need to work with PDFs in one place
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl text-balance">
            Fast, secure, browser-based utilities. No file uploads to untrusted servers, zero
            subscription hurdles, and zero document limits.
          </p>

          {/* Search + category pills */}
          <div className="w-full max-w-4xl mt-8 flex flex-col gap-4 items-center">
            <ToolSearch
              query={query}
              onQueryChange={setQuery}
              filter={filter}
              onFilterChange={setFilter}
            />
          </div>
        </div>
      </section>

      {/* Tool grid */}
      <main className="w-full max-w-7xl mx-auto px-4 md:px-6 py-12 space-y-12" id="tools">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-44 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="text-center py-20" data-testid="tools-empty">
            <FileSearch className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No tools match your search</h3>
            <p className="text-muted-foreground">Try “merge”, “compress”, “ocr” or “protect”.</p>
          </div>
          ) : (
            visibleGroups.map(({ meta, tools: groupTools, total }) => (
              <CategorySection key={meta.filter} meta={meta} count={total} id={`category-${meta.filter}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {groupTools.map((tool) => (
                    <ToolCard
                      key={tool.id}
                      id={tool.id}
                      name={tool.name}
                      description={tool.description}
                      icon={toolIcons[tool.id] ?? defaultToolIcon}
                      tone={toneForCategory(tool.category)}
                    />
                  ))}
                </div>
              </CategorySection>
            ))
          )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} PDF Tools. All files are deleted after processing.
          </p>
        </div>
      </footer>
    </div>
  );
}

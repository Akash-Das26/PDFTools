import { useListTools } from "@workspace/api-client-react";
import { Navbar } from "@/components/navbar";
import { ToolCard } from "@/components/tool-card";
import { StatsSection } from "@/components/stats-section";
import { toolIcons } from "@/lib/icons";
import { FileSearch, Sparkles, Hash, FileType, Check, X } from "lucide-react";

const ADVANTAGES = [
  {
    feature: "AI PDF Summarizer",
    icon: Sparkles,
    us: "Free, instant — no account",
    them: "Premium subscribers only",
    usGood: true,
    themGood: false,
    description: "Upload any PDF and get an AI-generated summary plus key points in seconds.",
  },
  {
    feature: "Add Page Numbers",
    icon: Hash,
    us: "Dedicated tool, 5 positions, custom start",
    them: "Buried inside the Watermark tool",
    usGood: true,
    themGood: false,
    description: "Stamp page numbers exactly where you want them — bottom-center, corners, top — with the format you choose.",
  },
  {
    feature: "Extract Text",
    icon: FileType,
    us: "Free browser tool",
    them: "Paid API tier only",
    usGood: true,
    themGood: false,
    description: "Pull all readable text from any PDF into a clean .txt file, right in your browser.",
  },
  {
    feature: "No watermarks on output",
    icon: Check,
    us: "Clean output always",
    them: "Clean output always",
    usGood: true,
    themGood: true,
    description: "Every processed file is returned watermark-free on both platforms.",
  },
];

export default function Home() {
  const { data: tools, isLoading } = useListTools();

  const groupedTools = tools?.reduce((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category]!.push(tool);
    return acc;
  }, {} as Record<string, typeof tools>);

  // Preferred category display order
  const categoryOrder = ["organize", "optimize", "security", "ai", "convert"];
  const sortedCategories = Object.keys(groupedTools || {}).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  const categoryLabels: Record<string, string> = {
    organize: "Organize",
    optimize: "Optimize",
    security: "Security",
    ai: "✦ AI-Powered",
    convert: "Convert",
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="w-full py-20 md:py-32 px-4 md:px-6">
        <div className="container max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            Now with free AI summarization
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Professional PDF Tools,<br className="hidden sm:block" /> Actually Free
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Merge, split, compress, watermark, and protect PDFs — plus AI summaries, text
            extraction, and page numbering. No paywalls, no watermarks on output.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <StatsSection />

      {/* Advantage Section */}
      <section className="w-full py-16 md:py-24 px-4 md:px-6 bg-muted/30">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">What we offer that others don't</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Three features that popular PDF tools either paywall or don't offer at all.
            </p>
          </div>

          {/* Comparison cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {ADVANTAGES.filter((a) => a.usGood && !a.themGood).map((adv) => {
              const Icon = adv.icon;
              return (
                <div
                  key={adv.feature}
                  className="bg-card border border-card-border rounded-xl p-6 flex flex-col gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-base mb-1">{adv.feature}</h3>
                      <p className="text-sm text-muted-foreground">{adv.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                    <div className="bg-green-500/8 border border-green-500/20 rounded-lg p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400 mb-1">
                        This app
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <p className="text-xs text-foreground/80">{adv.us}</p>
                      </div>
                    </div>
                    <div className="bg-muted/60 border border-border rounded-lg p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        iLovePDF
                      </p>
                      <div className="flex items-center gap-1.5">
                        <X className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                        <p className="text-xs text-muted-foreground">{adv.them}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Parity note */}
          <div className="flex items-center gap-3 bg-card border border-card-border rounded-xl px-6 py-4 max-w-lg mx-auto">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">No watermarks on processed files</span> — same as the original, always free.
            </p>
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="w-full py-16 md:py-24 px-4 md:px-6">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">All tools</h2>
            <p className="text-muted-foreground">Every PDF operation you need in one place.</p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-48 rounded-lg bg-card border border-card-border animate-pulse" />
              ))}
            </div>
          ) : !tools || tools.length === 0 ? (
            <div className="text-center py-20">
              <FileSearch className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No tools available</h3>
              <p className="text-muted-foreground">Check back later for available PDF tools.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {sortedCategories.map((category) => (
                <div key={category}>
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    {categoryLabels[category] ?? category}
                    {category === "ai" && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        FREE
                      </span>
                    )}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(groupedTools?.[category] ?? []).map((tool) => (
                      <ToolCard
                        key={tool.id}
                        id={tool.id}
                        name={tool.name}
                        description={tool.description}
                        icon={toolIcons[tool.id] || toolIcons.merge}
                        category={category}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-border mt-auto">
        <div className="container px-4 md:px-6 py-8">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} PDF Tools. All files are deleted after processing.
          </p>
        </div>
      </footer>
    </div>
  );
}

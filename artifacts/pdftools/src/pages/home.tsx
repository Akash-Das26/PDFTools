import { useListTools } from "@workspace/api-client-react";
import { Navbar } from "@/components/navbar";
import { ToolCard } from "@/components/tool-card";
import { StatsSection } from "@/components/stats-section";
import { toolIcons } from "@/lib/icons";
import { FileSearch } from "lucide-react";

export default function Home() {
  const { data: tools, isLoading } = useListTools();

  const groupedTools = tools?.reduce((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, typeof tools>);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="w-full py-20 md:py-32 px-4 md:px-6">
        <div className="container max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Professional PDF Tools
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Merge, split, compress, and protect your PDFs. Fast, reliable, and
            built for professionals who need precision.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <StatsSection />

      {/* Tools Grid */}
      <section className="w-full py-16 md:py-24 px-4 md:px-6">
        <div className="container max-w-6xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-48 rounded-lg bg-card border border-card-border animate-pulse"
                />
              ))}
            </div>
          ) : !tools || tools.length === 0 ? (
            <div className="text-center py-20">
              <FileSearch className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No tools available</h3>
              <p className="text-muted-foreground">
                Check back later for available PDF tools.
              </p>
            </div>
          ) : (
            <div className="space-y-12">
              {Object.entries(groupedTools || {}).map(([category, categoryTools]) => (
                <div key={category}>
                  <h2 className="text-2xl font-bold mb-6 capitalize">
                    {category}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categoryTools.map((tool) => (
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

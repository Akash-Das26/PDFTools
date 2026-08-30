import { Link } from "wouter";
import { ArrowRight, Check, ExternalLink, Sparkles, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/seo";
import { comparisons } from "@/lib/comparisons";

export default function CompareHub() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Seo
        title="PDF Tool Comparisons: Find the Best Alternative in 2026"
        description="Compare PDF Tools with iLovePDF, Smallpdf, Adobe Acrobat, PDF24, Sejda, Foxit, and Soda PDF on features, pricing, free limits, and ease of use."
        path="/compare"
      />
      <Navbar />
      <main className="flex-1">
        <section className="px-4 md:px-6 py-16 md:py-24">
          <div className="container max-w-5xl mx-auto text-center">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase mb-4">Independent comparison guides</p>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Find the right PDF tool
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Straightforward comparisons of the PDF platforms people actually search for.
              No invented weaknesses, no vague scores — just the trade-offs that matter.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/8 border border-primary/20 px-3 py-1.5 text-sm text-primary">
                <Sparkles className="w-4 h-4" /> Free AI summaries
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-green-500/8 border border-green-500/20 px-3 py-1.5 text-sm text-green-700 dark:text-green-400">
                <ShieldCheck className="w-4 h-4" /> No output watermarks
              </span>
            </div>
          </div>
        </section>

        <section className="px-4 md:px-6 pb-20">
          <div className="container max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {comparisons.map((comparison, index) => (
                <article
                  key={comparison.slug}
                  className={`group rounded-2xl border bg-card p-6 md:p-8 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
                    index === 0 ? "border-primary/30 md:col-span-2 bg-card" : "border-card-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold">
                        {comparison.shortName.slice(0, 1)}
                      </span>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">PDF Tools vs</p>
                        <h2 className="text-xl font-bold">{comparison.name}</h2>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    {comparison.intro}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className="text-xs rounded-full bg-muted px-3 py-1">Features</span>
                    <span className="text-xs rounded-full bg-muted px-3 py-1">Pricing</span>
                    <span className="text-xs rounded-full bg-muted px-3 py-1">Free options</span>
                    <span className="text-xs rounded-full bg-muted px-3 py-1">Verdict</span>
                  </div>
                  <Link href={`/compare/${comparison.slug}`} className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    Read the comparison <ArrowRight className="w-4 h-4" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 md:px-6 py-16 bg-muted/30 border-y border-border">
          <div className="container max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Still deciding?</h2>
            <p className="text-muted-foreground mb-7">
              Try the focused workflow that makes PDF Tools different: common PDF jobs,
              free AI summaries, and clean downloads in one place.
            </p>
            <Link href="/tools/merge">
              <Button size="lg">Try PDF Tools free <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </Link>
          </div>
        </section>
      </main>
      <footer className="w-full border-t border-border">
        <div className="container px-4 md:px-6 py-8">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} PDF Tools. Comparison guides are based on publicly documented product features.
          </p>
        </div>
      </footer>
    </div>
  );
}
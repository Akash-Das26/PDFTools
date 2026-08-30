import { Link, useParams } from "wouter";
import { ArrowRight, Check, ChevronRight, ExternalLink, Minus, Sparkles } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/seo";
import { comparisons, getComparison } from "@/lib/comparisons";

function ComparisonStructuredData(comparison: ReturnType<typeof getComparison>) {
  if (!comparison) return undefined;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: "PDF Tools",
        description: "Free browser-based PDF processing tools with AI summarization.",
        brand: { "@type": "Brand", name: "PDF Tools" },
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "Product",
        name: comparison.name,
        url: comparison.officialUrl,
        brand: { "@type": "Brand", name: comparison.name },
      },
      {
        "@type": "FAQPage",
        mainEntity: comparison.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "/" },
          { "@type": "ListItem", position: 2, name: "Comparisons", item: "/compare" },
          { "@type": "ListItem", position: 3, name: comparison.name, item: `/compare/${comparison.slug}` },
        ],
      },
    ],
  };
}

export default function ComparisonPage() {
  const { competitor } = useParams();
  const comparison = getComparison(competitor);

  if (!comparison) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-3">Comparison not found</h1>
            <p className="text-muted-foreground mb-6">Browse the available PDF comparison guides.</p>
            <Link href="/compare"><Button>View comparisons</Button></Link>
          </div>
        </main>
      </div>
    );
  }

  const related = comparisons.filter((item) => item.slug !== comparison.slug).slice(0, 3);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Seo
        title={comparison.title}
        description={comparison.description}
        path={`/compare/${comparison.slug}`}
        structuredData={ComparisonStructuredData(comparison)}
      />
      <Navbar />
      <main className="flex-1">
        <article>
          <section className="px-4 md:px-6 pt-10 md:pt-16 pb-12">
            <div className="container max-w-5xl mx-auto">
              <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground mb-10">
                <Link href="/" className="hover:text-foreground">Home</Link>
                <ChevronRight className="w-4 h-4" />
                <Link href="/compare" className="hover:text-foreground">Comparisons</Link>
                <ChevronRight className="w-4 h-4" />
                <span className="text-foreground">{comparison.shortName}</span>
              </nav>
              <div className="max-w-3xl">
                <p className="text-sm font-semibold tracking-wide text-primary uppercase mb-4">{comparison.eyebrow}</p>
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.08] mb-6">
                  PDF Tools vs {comparison.name}
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8">
                  Features, pricing, free options, and which PDF tool is better in 2026.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/tools/merge">
                    <Button size="lg">Try PDF Tools free <ArrowRight className="w-4 h-4 ml-2" /></Button>
                  </Link>
                  <a href={comparison.officialUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="lg">Visit {comparison.shortName} <ExternalLink className="w-4 h-4 ml-2" /></Button>
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="px-4 md:px-6 pb-16">
            <div className="container max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[1.3fr_0.7fr] gap-6">
              <div className="rounded-2xl border border-card-border bg-card p-6 md:p-8">
                <h2 className="text-xl font-bold mb-4">The short answer</h2>
                <p className="text-muted-foreground leading-relaxed">{comparison.intro}</p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8">
                <div className="flex items-center gap-2 text-primary mb-3">
                  <Sparkles className="w-5 h-5" />
                  <h2 className="font-bold">Our verdict</h2>
                </div>
                <p className="text-sm leading-relaxed text-foreground/80">{comparison.verdict}</p>
                <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-primary/15">
                  Best for: {comparison.bestFor}
                </p>
              </div>
            </div>
          </section>

          <section className="px-4 md:px-6 pb-20">
            <div className="container max-w-5xl mx-auto">
              <div className="mb-8">
                <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">Side by side</p>
                <h2 className="text-3xl font-bold">PDF Tools vs {comparison.name}</h2>
              </div>
              <div className="space-y-3">
                {comparison.rows.map((row) => (
                  <div key={row.label} className="grid grid-cols-1 md:grid-cols-[170px_1fr_1fr] gap-3 md:gap-0 rounded-xl border border-card-border bg-card overflow-hidden">
                    <div className="p-4 md:p-5 bg-muted/40 flex items-center">
                      <span className="text-sm font-semibold">{row.label}</span>
                    </div>
                    <div className="p-4 md:p-5 border-t md:border-t-0 md:border-l border-border">
                      <p className="text-[11px] uppercase tracking-wide text-primary font-semibold mb-2">PDF Tools</p>
                      <p className="text-sm leading-relaxed">{row.pdfTools}</p>
                    </div>
                    <div className="p-4 md:p-5 border-t md:border-t-0 md:border-l border-border">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">{comparison.shortName}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">{row.competitor}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="px-4 md:px-6 pb-20">
            <div className="container max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6 md:p-8">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center"><Check className="w-4 h-4 text-green-600 dark:text-green-400" /></div>
                  <h2 className="font-bold text-lg">PDF Tools pros</h2>
                </div>
                <ul className="space-y-3">
                  {comparison.pdfToolsPros.map((item) => <li key={item} className="flex gap-2 text-sm"><Check className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />{item}</li>)}
                </ul>
                <div className="mt-6 pt-5 border-t border-green-500/15">
                  <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-3">Trade-offs</p>
                  <ul className="space-y-2">{comparison.pdfToolsCons.map((item) => <li key={item} className="flex gap-2 text-sm text-muted-foreground"><Minus className="w-4 h-4 mt-0.5 shrink-0" />{item}</li>)}</ul>
                </div>
              </div>
              <div className="rounded-2xl border border-card-border bg-card p-6 md:p-8">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"><Check className="w-4 h-4 text-muted-foreground" /></div>
                  <h2 className="font-bold text-lg">{comparison.shortName} pros</h2>
                </div>
                <ul className="space-y-3">
                  {comparison.competitorPros.map((item) => <li key={item} className="flex gap-2 text-sm"><Check className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />{item}</li>)}
                </ul>
                <div className="mt-6 pt-5 border-t border-border">
                  <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-3">Trade-offs</p>
                  <ul className="space-y-2">{comparison.competitorCons.map((item) => <li key={item} className="flex gap-2 text-sm text-muted-foreground"><Minus className="w-4 h-4 mt-0.5 shrink-0" />{item}</li>)}</ul>
                </div>
              </div>
            </div>
          </section>

          <section className="px-4 md:px-6 pb-20">
            <div className="container max-w-3xl mx-auto">
              <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">FAQ</p>
              <h2 className="text-3xl font-bold mb-8">Common questions</h2>
              <div className="space-y-3">
                {comparison.faqs.map((faq) => (
                  <details key={faq.question} className="group rounded-xl border border-card-border bg-card px-5">
                    <summary className="cursor-pointer list-none flex items-center justify-between gap-4 py-5 font-semibold text-sm">
                      {faq.question}
                      <ChevronRight className="w-4 h-4 shrink-0 transition-transform group-open:rotate-90 text-muted-foreground" />
                    </summary>
                    <p className="pb-5 text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          <section className="px-4 md:px-6 py-16 bg-primary text-primary-foreground">
            <div className="container max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Try the simpler PDF workflow</h2>
              <p className="text-primary-foreground/80 max-w-xl mx-auto mb-7">
                Process a file in seconds, or see what a free AI summary looks like.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href="/tools/merge"><Button variant="secondary" size="lg">Merge a PDF</Button></Link>
                <Link href="/tools/ai-summarize"><Button variant="outline" size="lg" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">Summarise with AI</Button></Link>
              </div>
            </div>
          </section>

          <section className="px-4 md:px-6 py-16">
            <div className="container max-w-5xl mx-auto">
              <div className="flex items-end justify-between gap-4 mb-6">
                <div>
                  <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">Keep comparing</p>
                  <h2 className="text-2xl font-bold">More PDF comparisons</h2>
                </div>
                <Link href="/compare" className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-primary">All comparisons <ArrowRight className="w-4 h-4" /></Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {related.map((item) => (
                  <Link key={item.slug} href={`/compare/${item.slug}`} className="group rounded-xl border border-card-border bg-card p-5 hover:shadow-md transition-all">
                    <p className="text-xs text-muted-foreground mb-2">PDF Tools vs</p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{item.name}</span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </article>
      </main>
      <footer className="w-full border-t border-border">
        <div className="container px-4 md:px-6 py-8">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} PDF Tools. Information checked against publicly documented product pages.
          </p>
        </div>
      </footer>
    </div>
  );
}
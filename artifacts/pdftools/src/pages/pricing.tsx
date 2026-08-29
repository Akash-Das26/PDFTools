import { Link } from "wouter";
import { Check, ArrowLeft, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";

const INCLUDED = [
  "All core PDF tools",
  "AI summaries with key points",
  "Text extraction to .txt",
  "Custom page numbering",
  "No watermarks on output",
  "Files deleted after processing",
];

export default function Pricing() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 py-14 md:py-20 px-4 md:px-6">
        <div className="container max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back home
          </Link>

          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-primary mb-3">PRICING</p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Everything you need.<br />Nothing paywalled.
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              The complete PDF toolkit, including AI-powered features, is available
              free while we build the fairest way to support the product.
            </p>
          </div>

          <div className="max-w-md mx-auto bg-card border-2 border-primary/30 rounded-2xl overflow-hidden shadow-lg">
            <div className="bg-primary px-6 py-4 text-primary-foreground flex items-center justify-between">
              <div>
                <p className="font-bold text-lg">Free, for everyone</p>
                <p className="text-sm text-primary-foreground/80">No account or trial required</p>
              </div>
              <span className="text-2xl font-bold">$0</span>
            </div>
            <div className="p-6 md:p-8">
              <div className="space-y-4 mb-8">
                {INCLUDED.map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    </span>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
              <Link href="/" className="block">
                <Button className="w-full" size="lg">
                  Start processing
                </Button>
              </Link>
              <p className="text-xs text-center text-muted-foreground mt-4">
                We may introduce optional paid plans in the future. Core tools will remain available.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
            <div className="text-center p-5">
              <Sparkles className="w-6 h-6 mx-auto mb-3 text-primary" />
              <h2 className="font-semibold mb-1">AI included</h2>
              <p className="text-sm text-muted-foreground">Summarise PDFs without a premium upgrade.</p>
            </div>
            <div className="text-center p-5">
              <ShieldCheck className="w-6 h-6 mx-auto mb-3 text-green-600 dark:text-green-400" />
              <h2 className="font-semibold mb-1">Clean output</h2>
              <p className="text-sm text-muted-foreground">No added watermarks on any processed file.</p>
            </div>
            <div className="text-center p-5">
              <Zap className="w-6 h-6 mx-auto mb-3 text-accent-foreground" />
              <h2 className="font-semibold mb-1">No friction</h2>
              <p className="text-sm text-muted-foreground">No signup flow before you can get work done.</p>
            </div>
          </div>
        </div>
      </main>
      <footer className="w-full border-t border-border">
        <div className="container px-4 md:px-6 py-8">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} PDF Tools. All files are deleted after processing.
          </p>
        </div>
      </footer>
    </div>
  );
}
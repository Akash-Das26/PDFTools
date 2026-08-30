import { Navbar } from "@/components/navbar";
import { Shield, Clock, Lock, Trash2 } from "lucide-react";
import { Seo } from "@/components/seo";

export default function About() {
  const features = [
    {
      icon: Shield,
      title: "Privacy First",
      description:
        "All files are processed securely on our servers and never shared with third parties.",
    },
    {
      icon: Clock,
      title: "Automatic Deletion",
      description:
        "Files are automatically deleted after processing. Nothing is stored permanently.",
    },
    {
      icon: Lock,
      title: "Secure Processing",
      description:
        "Industry-standard encryption ensures your documents remain confidential during processing.",
    },
    {
      icon: Trash2,
      title: "Zero Retention",
      description:
        "We don't keep logs of your file names or content. Your data is your data.",
    },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Seo
        title="About PDF Tools: Fast, Private PDF Processing"
        description="Learn how PDF Tools makes everyday PDF processing fast, focused, and privacy-conscious."
        path="/about"
      />
      <Navbar />

      <main className="flex-1">
        <div className="container max-w-4xl mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="mb-16 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Built for Professionals
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              PDF Tools is a precision instrument for people who work with
              documents daily. Fast, reliable, and uncluttered — the tool you
              reach for without thinking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex gap-4"
                data-testid={`feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card border border-card-border rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">How It Works</h2>
            <ol className="space-y-4 text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-bold text-foreground">1.</span>
                <span>
                  Choose your tool — merge, split, compress, rotate, watermark, or
                  protect.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-foreground">2.</span>
                <span>
                  Upload your PDF files. For merge, you can upload multiple files.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-foreground">3.</span>
                <span>
                  Adjust tool-specific options (quality, rotation, password, etc.).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-foreground">4.</span>
                <span>
                  Click Process. Your file is processed instantly and downloaded to
                  your device.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-foreground">5.</span>
                <span>
                  Your files are deleted from our servers immediately after processing.
                </span>
              </li>
            </ol>
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

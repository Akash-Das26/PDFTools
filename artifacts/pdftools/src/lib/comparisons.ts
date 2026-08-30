export interface ComparisonFaq {
  question: string;
  answer: string;
}

export interface ComparisonRow {
  label: string;
  pdfTools: string;
  competitor: string;
}

export interface ComparisonData {
  slug: string;
  name: string;
  shortName: string;
  officialUrl: string;
  title: string;
  description: string;
  eyebrow: string;
  intro: string;
  verdict: string;
  bestFor: string;
  pdfToolsPros: string[];
  pdfToolsCons: string[];
  competitorPros: string[];
  competitorCons: string[];
  rows: ComparisonRow[];
  faqs: ComparisonFaq[];
}

const PDF_TOOLS_ROWS: ComparisonRow[] = [
  {
    label: "Key features",
    pdfTools: "Merge, split, compress, rotate, watermark, protect, unlock, AI summary, extract text, page numbers",
    competitor: "",
  },
  {
    label: "Pricing",
    pdfTools: "$0 — no account required",
    competitor: "",
  },
  {
    label: "Free option",
    pdfTools: "Core tools, AI summaries, text extraction, and page numbering",
    competitor: "",
  },
  {
    label: "Speed",
    pdfTools: "Fast for common browser-based PDF jobs",
    competitor: "",
  },
  {
    label: "Accuracy",
    pdfTools: "High for standard PDFs; AI quality depends on readable text",
    competitor: "",
  },
  {
    label: "Ease of use",
    pdfTools: "Focused upload-first flow with clear tool-specific options",
    competitor: "",
  },
];

function withCompetitorRows(
  competitorRows: string[],
): ComparisonRow[] {
  return PDF_TOOLS_ROWS.map((row, index) => ({
    ...row,
    competitor: competitorRows[index] ?? "",
  }));
}

export const comparisons: ComparisonData[] = [
  {
    slug: "ilovepdf",
    name: "iLovePDF",
    shortName: "iLovePDF",
    officialUrl: "https://www.ilovepdf.com/",
    title: "PDF Tools vs iLovePDF: Features, Pricing & Verdict 2026",
    description:
      "Compare PDF Tools and iLovePDF on features, pricing, free options, speed, accuracy, ease of use, and privacy in this honest 2026 guide.",
    eyebrow: "The original brand comparison",
    intro:
      "iLovePDF is a familiar online PDF suite with a broad collection of web, desktop, and mobile tools. PDF Tools takes a narrower, upload-first approach and adds AI summarization, browser text extraction, and dedicated page numbering to the workflow.",
    verdict:
      "Choose PDF Tools for a focused free workflow with AI summaries and no account gate. Choose iLovePDF if you need its larger ecosystem, integrations, or broader conversion catalog.",
    bestFor: "People who want quick everyday PDF jobs without navigating a large suite.",
    pdfToolsPros: ["Focused tool selection", "AI summary included", "No account required"],
    pdfToolsCons: ["Smaller conversion catalog", "No desktop application"],
    competitorPros: ["Broad web tool catalog", "Desktop and mobile products", "Recognisable workflow"],
    competitorCons: ["Larger interface to navigate", "Free availability varies by tool and plan"],
    rows: withCompetitorRows([
      "Broad PDF suite across web, desktop, and mobile products",
      "Free tier plus paid Premium plans",
      "Essential tools available free; plan limits vary by tool",
      "Designed for quick online processing",
      "Established PDF processing across a wide tool catalog",
      "Familiar, straightforward tool-by-tool interface",
    ]),
    faqs: [
      {
        question: "Is PDF Tools a good iLovePDF alternative?",
        answer:
          "Yes, if you mainly need everyday PDF organization, protection, compression, AI summaries, text extraction, and page numbering. iLovePDF remains a stronger fit for users who need its wider conversion catalog and connected products.",
      },
      {
        question: "iLovePDF vs PDF Tools: which is better?",
        answer:
          "Neither is best for every workflow. PDF Tools is the simpler free option for focused browser jobs, while iLovePDF is better suited to users who value breadth across many PDF formats and devices.",
      },
      {
        question: "Does PDF Tools add watermarks to output files?",
        answer:
          "No. PDF Tools is designed to return clean processed files without adding a product watermark.",
      },
    ],
  },
  {
    slug: "smallpdf",
    name: "Smallpdf",
    shortName: "Smallpdf",
    officialUrl: "https://smallpdf.com/",
    title: "PDF Tools vs Smallpdf: Features, Pricing & Verdict 2026",
    description:
      "PDF Tools vs Smallpdf: compare features, free limits, AI PDF tools, pricing, ease of use, and the best choice for everyday PDF work in 2026.",
    eyebrow: "A focused free alternative",
    intro:
      "Smallpdf is a polished all-in-one PDF platform with 30+ document tools, AI PDF features, and collaboration products. PDF Tools is intentionally smaller: it puts the most common operations, free AI summaries, text extraction, and page numbering in one uncluttered flow.",
    verdict:
      "Choose PDF Tools for a focused no-account workflow and genuinely free core features. Choose Smallpdf for a larger suite with editing, signing, integrations, and collaboration.",
    bestFor: "Users who prefer a smaller toolset and transparent free access for common jobs.",
    pdfToolsPros: ["No signup before processing", "Free AI and text extraction", "Less interface overhead"],
    pdfToolsCons: ["Fewer editing and signing features", "No cloud integrations"],
    competitorPros: ["30+ document tools", "AI PDF category", "Extensions and integrations"],
    competitorCons: ["Free plan has usage limits", "Advanced workflows require paid access"],
    rows: withCompetitorRows([
      "Core PDF tools plus 30+ document management tools, AI PDF, and signing",
      "Free plan plus Pro and team subscriptions",
      "Free plan includes limited document downloads and tool usage",
      "Fast, polished browser experience",
      "Strong general-purpose conversion and editing workflow",
      "Highly polished, broad navigation with more choices",
    ]),
    faqs: [
      {
        question: "Is PDF Tools a good Smallpdf alternative?",
        answer:
          "PDF Tools is a good Smallpdf alternative when you need common PDF operations, free AI summaries, text extraction, and page numbering without starting a trial or creating an account. Smallpdf is stronger for editing, signing, and integrations.",
      },
      {
        question: "Smallpdf vs PDF Tools: which is better for free PDF editing?",
        answer:
          "PDF Tools is better for the specific operations it supports without an account. Smallpdf offers a more complete editor, but its free plan has usage limits and advanced features are part of paid plans.",
      },
      {
        question: "Does Smallpdf have more tools than PDF Tools?",
        answer:
          "Yes. Smallpdf advertises 30+ document tools and includes editing, signing, AI PDF, and integrations. PDF Tools focuses on a smaller set of everyday PDF tasks.",
      },
    ],
  },
  {
    slug: "adobe-acrobat",
    name: "Adobe Acrobat",
    shortName: "Adobe Acrobat",
    officialUrl: "https://www.adobe.com/acrobat/online.html",
    title: "PDF Tools vs Adobe Acrobat: Features, Pricing & Verdict 2026",
    description:
      "Compare PDF Tools and Adobe Acrobat on online tools, AI, pricing, free access, speed, accuracy, and ease of use in this 2026 PDF guide.",
    eyebrow: "Simple browser jobs vs the full PDF standard",
    intro:
      "Adobe Acrobat is the most comprehensive option here, combining online tools with full desktop editing, e-signatures, document management, and AI Assistant features. PDF Tools is built for people who want a fast, focused browser utility without a subscription decision.",
    verdict:
      "Choose PDF Tools for quick free PDF operations and lightweight AI summaries. Choose Acrobat for advanced editing, signing, enterprise workflows, and the deepest document ecosystem.",
    bestFor: "People who need an occasional PDF job done quickly in the browser.",
    pdfToolsPros: ["Free core workflow", "No account required", "Fast to understand"],
    pdfToolsCons: ["No full editor", "No e-signature workflow"],
    competitorPros: ["Deep PDF editing", "E-signatures and forms", "AI Assistant and desktop apps"],
    competitorCons: ["More complex product", "Most advanced workflows are paid"],
    rows: withCompetitorRows([
      "Online tools plus desktop editing, e-signatures, forms, and AI Assistant",
      "Free online tools plus paid Acrobat plans",
      "25+ online tools available free; sign-in and plan rules vary",
      "Reliable at scale, with more processing steps",
      "Very strong for professional editing and document workflows",
      "Powerful but more complex than a focused utility",
    ]),
    faqs: [
      {
        question: "Is PDF Tools a good Adobe Acrobat alternative?",
        answer:
          "It is a good alternative for simple browser tasks such as merging, splitting, compressing, rotating, protecting, extracting text, and adding page numbers. Acrobat is the better choice for full editing, e-signatures, forms, and enterprise document management.",
      },
      {
        question: "Adobe Acrobat vs PDF Tools: which is better?",
        answer:
          "PDF Tools is better for a quick, free, focused task. Acrobat is better when you need a full PDF editor or advanced signing and collaboration features.",
      },
      {
        question: "Can PDF Tools replace Acrobat for professional PDF editing?",
        answer:
          "Not completely. PDF Tools covers common processing jobs, but it does not replace Acrobat’s full editing, form, e-signature, and enterprise capabilities.",
      },
    ],
  },
  {
    slug: "pdf24",
    name: "PDF24",
    shortName: "PDF24",
    officialUrl: "https://tools.pdf24.org/en/",
    title: "PDF Tools vs PDF24: Features, Pricing & Verdict 2026",
    description:
      "PDF Tools vs PDF24: compare free PDF tools, privacy, OCR, speed, accuracy, ease of use, and features to choose the right PDF utility in 2026.",
    eyebrow: "Two free-first PDF toolkits",
    intro:
      "PDF24 is one of the strongest free-first alternatives, with a large collection of online tools and a Windows desktop creator. PDF Tools trades catalog breadth for a cleaner flow, an AI summarizer, and a cross-platform browser experience.",
    verdict:
      "Choose PDF Tools for the cleanest focused workflow and AI assistance. Choose PDF24 for the broadest free catalog or if you want a Windows desktop utility.",
    bestFor: "Users who want a genuinely free toolkit and do not mind a larger catalog.",
    pdfToolsPros: ["Cross-platform browser workflow", "AI summarizer", "Focused navigation"],
    pdfToolsCons: ["Smaller feature catalog", "No offline desktop app"],
    competitorPros: ["Large free tool collection", "PDF24 Creator for Windows", "Strong utility orientation"],
    competitorCons: ["More tools to scan through", "Desktop app is Windows-focused"],
    rows: withCompetitorRows([
      "Large collection of online PDF tools plus PDF24 Creator",
      "Free online tools; desktop software available",
      "Broad set of tools promoted as free",
      "Fast for typical utility operations",
      "Strong everyday utility coverage",
      "Functional, catalog-driven interface",
    ]),
    faqs: [
      {
        question: "Is PDF Tools a good PDF24 alternative?",
        answer:
          "Yes, if you want a smaller browser-based toolkit with AI summaries, text extraction, and a clear upload-first flow. PDF24 is a better fit when you want many specialized utilities or a Windows desktop application.",
      },
      {
        question: "PDF24 vs PDF Tools: which is more private?",
        answer:
          "Both are designed for PDF processing workflows, but their exact retention and infrastructure policies should be reviewed on their respective privacy pages. PDF Tools states that uploaded files are deleted after processing.",
      },
      {
        question: "Is PDF24 completely free?",
        answer:
          "PDF24 promotes a broad set of free online tools and also offers desktop software. Specific capabilities and platform behavior can vary, so check the current tool page before processing a specialized file.",
      },
    ],
  },
  {
    slug: "sejda",
    name: "Sejda PDF",
    shortName: "Sejda",
    officialUrl: "https://www.sejda.com/",
    title: "PDF Tools vs Sejda: Features, Pricing & Verdict 2026",
    description:
      "Compare PDF Tools and Sejda PDF on free limits, editing, pricing, speed, accuracy, ease of use, and the best everyday PDF workflow in 2026.",
    eyebrow: "Everyday PDF processing compared",
    intro:
      "Sejda is known for online PDF editing and a desktop app, with a useful free tier that has daily and document limits. PDF Tools focuses on a smaller set of processing jobs with no sign-up flow and adds AI summaries and text extraction.",
    verdict:
      "Choose PDF Tools for straightforward free processing with fewer decisions. Choose Sejda when direct PDF editing, annotations, or offline desktop use matter more.",
    bestFor: "Users who need editing and annotations alongside PDF utility tools.",
    pdfToolsPros: ["No account gate", "AI summaries included", "Simple processing flow"],
    pdfToolsCons: ["No visual PDF editor", "No offline mode"],
    competitorPros: ["Online PDF editor", "Desktop app", "Many utility tools"],
    competitorCons: ["Daily and document limits on free use", "Paid plan for unlimited access"],
    rows: withCompetitorRows([
      "Online tools, PDF editor, forms, conversions, and desktop app",
      "Free tier plus paid Web Week, Web Month, and Desktop plans",
      "Free use subject to page, file-size, hourly, or daily limits",
      "Quick for small jobs; limits affect larger batches",
      "Strong editing and utility coverage",
      "Clear task-specific tools with more editing controls",
    ]),
    faqs: [
      {
        question: "Is PDF Tools a good Sejda alternative?",
        answer:
          "PDF Tools is a good Sejda alternative for focused processing, AI summaries, and text extraction without a sign-up flow. Sejda is a better fit if you need to edit, annotate, or fill a PDF visually.",
      },
      {
        question: "Sejda vs PDF Tools: which has fewer free limits?",
        answer:
          "PDF Tools does not add an account-based daily quota to its core workflow. It does enforce practical upload limits on the server. Sejda clearly documents page, file-size, hourly, and daily limits for free use.",
      },
      {
        question: "Can PDF Tools edit text like Sejda?",
        answer:
          "No. PDF Tools currently focuses on processing operations rather than visual text editing. Sejda offers a dedicated online PDF editor.",
      },
    ],
  },
  {
    slug: "foxit",
    name: "Foxit PDF",
    shortName: "Foxit",
    officialUrl: "https://www.foxit.com/pdf-editor/",
    title: "PDF Tools vs Foxit PDF: Features, Pricing & Verdict 2026",
    description:
      "PDF Tools vs Foxit PDF: compare editing, AI, pricing, free access, speed, accuracy, security, and ease of use in this honest 2026 guide.",
    eyebrow: "Lightweight tools vs professional editing",
    intro:
      "Foxit is a professional PDF platform focused on editing, conversion, collaboration, and AI-assisted document work across desktop and web. PDF Tools is a lighter browser utility for common operations, with free AI summaries and no account required.",
    verdict:
      "Choose PDF Tools for a fast free utility. Choose Foxit for professional editing, collaboration, business controls, and a desktop-first PDF workflow.",
    bestFor: "People who only need to process a PDF instead of manage a full document lifecycle.",
    pdfToolsPros: ["Free for core tasks", "No account required", "Minimal interface"],
    pdfToolsCons: ["No advanced editor", "No business collaboration suite"],
    competitorPros: ["Professional editor", "Desktop and web products", "AI and business features"],
    competitorCons: ["Paid product focus", "More setup for occasional tasks"],
    rows: withCompetitorRows([
      "PDF editor, conversion, collaboration, eSign, and AI features",
      "Paid subscriptions with trials or limited included credits",
      "Limited free access and trial pathways vary by product",
      "Built for reliable professional workflows",
      "Strong professional editing and conversion capabilities",
      "More controls and setup than a utility-only tool",
    ]),
    faqs: [
      {
        question: "Is PDF Tools a good Foxit alternative?",
        answer:
          "It is a good Foxit alternative for common PDF processing jobs and lightweight AI summaries. Foxit is better when you need a full editor, business collaboration, or desktop PDF management.",
      },
      {
        question: "Foxit vs PDF Tools: which is better for occasional PDF jobs?",
        answer:
          "PDF Tools is the simpler choice for occasional browser jobs. Foxit is more capable for professional document workflows but offers more features than a casual task usually requires.",
      },
      {
        question: "Does Foxit have AI PDF features?",
        answer:
          "Foxit promotes AI-assisted PDF capabilities and AI Assistant options. PDF Tools offers a narrower AI summarization workflow focused on extracting a concise summary and key points.",
      },
    ],
  },
  {
    slug: "soda-pdf",
    name: "Soda PDF",
    shortName: "Soda PDF",
    officialUrl: "https://www.sodapdf.com/",
    title: "PDF Tools vs Soda PDF: Features, Pricing & Verdict 2026",
    description:
      "Compare PDF Tools and Soda PDF on online tools, free limits, OCR, batch processing, pricing, speed, accuracy, and ease of use in 2026.",
    eyebrow: "A lighter free workflow",
    intro:
      "Soda PDF combines online and desktop tools for editing, conversion, OCR, forms, and e-signatures. Its published free-access policy describes limits for many tools. PDF Tools keeps the experience smaller and makes core processing, text extraction, page numbering, and AI summaries free.",
    verdict:
      "Choose PDF Tools for quick free processing without a product tour. Choose Soda PDF for editing, OCR, forms, e-signatures, and broader document workflows.",
    bestFor: "Users who value a simple browser tool over a full document suite.",
    pdfToolsPros: ["Focused free toolkit", "AI summaries and text extraction", "No account required"],
    pdfToolsCons: ["No forms or e-signatures", "No batch editor"],
    competitorPros: ["Online and desktop products", "OCR and forms", "E-signature workflows"],
    competitorCons: ["Free policy includes daily/file-size limits", "More features to configure"],
    rows: withCompetitorRows([
      "Online and desktop PDF editor, conversion, OCR, forms, and eSign",
      "Free access plus paid Standard and Pro plans",
      "Many free tools limited to 2 files per day or 3 MB",
      "Good for online document workflows; limits affect larger jobs",
      "Broad editor, OCR, and document workflow coverage",
      "Accessible, but broader than a single-purpose utility",
    ]),
    faqs: [
      {
        question: "Is PDF Tools a good Soda PDF alternative?",
        answer:
          "Yes, for quick PDF processing, AI summaries, text extraction, and page numbering without a sign-up flow. Soda PDF is better when you need OCR, forms, e-signatures, or a full editor.",
      },
      {
        question: "Soda PDF vs PDF Tools: which is better for free use?",
        answer:
          "PDF Tools is built around free core processing without a daily product quota. Soda PDF’s published free-access policy lists 2-file-per-day or 3 MB limits for many tools.",
      },
      {
        question: "Does Soda PDF support OCR and batch processing?",
        answer:
          "Soda PDF promotes OCR and broader document workflows, including batch-oriented capabilities in its product materials. PDF Tools currently focuses on text-layer extraction rather than OCR.",
      },
    ],
  },
];

export function getComparison(slug: string | undefined) {
  return comparisons.find((comparison) => comparison.slug === slug);
}
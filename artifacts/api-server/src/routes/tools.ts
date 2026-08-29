import { Router, type IRouter } from "express";

const router: IRouter = Router();

export const PDF_TOOLS = [
  // Organize
  {
    id: "merge",
    name: "Merge PDF",
    description: "Combine multiple PDFs into a single document in seconds.",
    category: "organize",
    icon: "Combine",
    inputLabel: "Select PDFs to merge",
    outputLabel: "Merged PDF",
    acceptMultiple: true,
    color: "#4F8EF7",
  },
  {
    id: "split",
    name: "Split PDF",
    description: "Separate one page or a whole set into independent PDFs.",
    category: "organize",
    icon: "Scissors",
    inputLabel: "Select PDF to split",
    outputLabel: "Split pages",
    acceptMultiple: false,
    color: "#4F8EF7",
  },
  {
    id: "rotate",
    name: "Rotate PDF",
    description: "Rotate your PDFs the way you need them, one or all pages.",
    category: "organize",
    icon: "RotateCw",
    inputLabel: "Select PDFs to rotate",
    outputLabel: "Rotated PDF",
    acceptMultiple: true,
    color: "#4F8EF7",
  },
  // Optimize
  {
    id: "compress",
    name: "Compress PDF",
    description: "Reduce file size while keeping the best possible quality.",
    category: "optimize",
    icon: "Package",
    inputLabel: "Select PDF to compress",
    outputLabel: "Compressed PDF",
    acceptMultiple: false,
    color: "#F97316",
  },
  {
    id: "watermark",
    name: "Watermark PDF",
    description: "Stamp an image or text over your PDFs. Choose the typography and transparency.",
    category: "optimize",
    icon: "Stamp",
    inputLabel: "Select PDF to watermark",
    outputLabel: "Watermarked PDF",
    acceptMultiple: false,
    color: "#F97316",
  },
  // Security
  {
    id: "protect",
    name: "Protect PDF",
    description: "Protect PDF files with a password. Encrypt PDF documents to prevent unauthorized access.",
    category: "security",
    icon: "Lock",
    inputLabel: "Select PDF to protect",
    outputLabel: "Protected PDF",
    acceptMultiple: false,
    color: "#8B5CF6",
  },
  {
    id: "unlock",
    name: "Unlock PDF",
    description: "Remove PDF password security, giving you the freedom to use your PDFs as you want.",
    category: "security",
    icon: "Unlock",
    inputLabel: "Select PDF to unlock",
    outputLabel: "Unlocked PDF",
    acceptMultiple: false,
    color: "#8B5CF6",
  },
  // AI
  {
    id: "ai-summarize",
    name: "AI Summarizer",
    description: "Get an instant AI-generated summary and key points from any PDF. Completely free — no paywall.",
    category: "ai",
    icon: "Sparkles",
    inputLabel: "Select PDF to summarize",
    outputLabel: "Summary",
    acceptMultiple: false,
    color: "#E5322D",
  },
  // Convert
  {
    id: "add-page-numbers",
    name: "Add Page Numbers",
    description: "Stamp page numbers on every page. Pick position, style, and starting number.",
    category: "organize",
    icon: "Hash",
    inputLabel: "Select PDF to number",
    outputLabel: "Numbered PDF",
    acceptMultiple: false,
    color: "#4F8EF7",
  },
  {
    id: "extract-text",
    name: "Extract Text",
    description: "Pull all readable text from a PDF into a plain .txt file. Free, instant, no account needed.",
    category: "convert",
    icon: "FileType",
    inputLabel: "Select PDF to extract text from",
    outputLabel: "Extracted Text (.txt)",
    acceptMultiple: false,
    color: "#10B981",
  },
];

router.get("/tools", async (_req, res): Promise<void> => {
  res.json(PDF_TOOLS);
});

export default router;

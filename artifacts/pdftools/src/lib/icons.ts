import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  Code,
  Combine,
  Crop,
  Download,
  Eraser,
  FileCode,
  FileMinus,
  FileOutput,
  FileText,
  FolderOpen,
  GitCompare,
  GripVertical,
  Hash,
  Image,
  Images,
  Info,
  Languages,
  ListOrdered,
  LoaderCircle,
  Lock,
  MessageSquare,
  Minimize2,
  Moon,
  PenLine,
  PenTool,
  Plus,
  Presentation,
  RotateCcw,
  RotateCw,
  ScanText,
  Scissors,
  Search,
  Sheet,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  Sun,
  Trash2,
  TriangleAlert,
  Unlock,
  Upload,
  UploadCloud,
  X,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";
import type { Tool } from "@workspace/api-client-react";

/**
 * The single icon registry.
 *
 * Rule: one icon per tool, used identically on the landing card, the header nav
 * and the workspace header. The catalog stores the lucide export *name*; this
 * registry is the only place that name is bound to a component, so a card and
 * its workspace can never drift onto different glyphs.
 *
 * NOTE (lucide-react 0.545.0): the reference design names a "compress" glyph,
 * but lucide ships no `Compress` export. `Minimize2` (arrows converging inward)
 * is the standardized substitute and is used for the compress tool everywhere.
 * This is the only icon deviation from the reference.
 */
const REGISTRY: Record<string, LucideIcon> = {
  Archive,
  ClipboardCheck,
  Code,
  Combine,
  Crop,
  Eraser,
  FileCode,
  FileMinus,
  FileOutput,
  FileText,
  GitCompare,
  Hash,
  Image,
  Images,
  Languages,
  ListOrdered,
  Lock,
  MessageSquare,
  Minimize2,
  PenLine,
  PenTool,
  Presentation,
  RotateCw,
  ScanText,
  Scissors,
  Sheet,
  Sparkles,
  Stamp,
  Unlock,
};

/** Fallback for a catalog entry whose icon name is unknown. */
export const fallbackIcon: LucideIcon = FileText;

/** Resolve the catalog's lucide export name to a component. */
export function iconForTool(tool: Pick<Tool, "icon">): LucideIcon {
  return REGISTRY[tool.icon] ?? fallbackIcon;
}

/** Shared chrome/nav glyphs used outside the tool registry. */
export const uiIcons = {
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  check: Check,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  circleAlert: CircleAlert,
  circleCheck: CircleCheck,
  download: Download,
  folderOpen: FolderOpen,
  gripVertical: GripVertical,
  info: Info,
  loader: LoaderCircle,
  moon: Moon,
  plus: Plus,
  rotateCcw: RotateCcw,
  search: Search,
  sliders: SlidersHorizontal,
  sun: Sun,
  trash: Trash2,
  triangleAlert: TriangleAlert,
  upload: Upload,
  uploadCloud: UploadCloud,
  x: X,
  zoomIn: ZoomIn,
} satisfies Record<string, LucideIcon>;

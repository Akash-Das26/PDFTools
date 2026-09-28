import { OptionField } from "@/components/tool-options/parts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Translate PDF — Configure panel for `POST /pdf/translate-pdf`.
 *
 * One choice: the target language. The list mirrors the languages the OCR
 * tool ships packs for, written in full because the words go into the model
 * prompt. The note states the two honest limits up front: layout is not
 * rebuilt (the result is the translated text, page by page — not a translated
 * PDF), and the work is one model call per page, so long documents cost
 * real minutes.
 */
const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "italian", label: "Italian" },
  { value: "portuguese", label: "Portuguese" },
  { value: "dutch", label: "Dutch" },
  { value: "polish", label: "Polish" },
  { value: "turkish", label: "Turkish" },
  { value: "russian", label: "Russian" },
  { value: "arabic", label: "Arabic" },
  { value: "hebrew", label: "Hebrew" },
  { value: "hindi", label: "Hindi" },
  { value: "chinese (simplified)", label: "Chinese (simplified)" },
  { value: "chinese (traditional)", label: "Chinese (traditional)" },
  { value: "japanese", label: "Japanese" },
  { value: "korean", label: "Korean" },
] as const;

export function TranslatePdfOptions({
  options,
  onChange,
}: {
  options: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const language = LANGUAGES.some((entry) => entry.value === options.targetLanguage)
    ? (options.targetLanguage as string)
    : "english";

  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField label="Translate into" hint="The document's text, page by page">
        <Select value={language} onValueChange={(value) => onChange({ targetLanguage: value })}>
          <SelectTrigger data-testid="translate-language" className="max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((entry) => (
              <SelectItem key={entry.value} value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </OptionField>

      <p data-testid="translate-note" className="text-body-sm text-muted-foreground">
        The result is the document's translated text, page by page, as a
        Markdown download — the layout of the original is not rebuilt into a
        second PDF. Every page is one request to the translation model, so a
        long document takes real minutes and at most 50 text pages are
        translated per run.
      </p>
    </div>
  );
}

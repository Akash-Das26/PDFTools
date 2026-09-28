import { OptionField } from "@/components/tool-options/parts";

/**
 * Chat with Document — Configure panel for `POST /pdf/chat-with-document`.
 *
 * One field: the question. The note states the honest scope — one grounded
 * answer from the document's text layer — and the run is refused up front
 * (like the protect-password guard) when the question is empty.
 */
export function ChatWithDocumentOptions({
  options,
  onChange,
}: {
  options: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField label="Your question" hint="Answered from the document">
        <textarea
          data-testid="chat-question"
          value={typeof options.question === "string" ? options.question : ""}
          onChange={(event) => onChange({ question: event.target.value })}
          rows={3}
          maxLength={2000}
          placeholder="What is the ticket number and who is it issued to?"
          className="w-full max-w-xl rounded-lg border border-border bg-surface-container-lowest p-space-md text-body-md text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </OptionField>

      <p data-testid="chat-note" className="text-body-sm text-muted-foreground">
        The answer comes from the document's own text — the model is told to
        quote it and to say so when the document does not contain the answer.
        This is one question per run; ask again with the document still loaded
        for anything else. Scanned documents need OCR first.
      </p>
    </div>
  );
}

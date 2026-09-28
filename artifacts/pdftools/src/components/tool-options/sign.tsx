import { OptionField } from "@/components/tool-options/parts";

/**
 * Sign — Configure panel for `POST /pdf/sign`.
 *
 * Two fields: the signer name shown on the visible stamp, and the
 * passphrase. The panel never asks for a certificate file — the API takes an
 * optional .p12 part, and when it is absent the server generates a self-signed
 * certificate for the run (probed pipeline; no timestamp authority). Without a
 * passphrase the endpoint 400s, and the workspace refuses to start the run at
 * all (the tool page gates on this, like the protect-password guard).
 */
export function SignOptions({
  options,
  onChange,
}: {
  options: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField label="Signer name" hint="Drawn on the stamp">
        <input
          data-testid="sign-name"
          type="text"
          value={typeof options.signerName === "string" ? options.signerName : ""}
          onChange={(event) => onChange({ signerName: event.target.value })}
          placeholder="Ada Lovelace"
          maxLength={120}
          className="w-full max-w-md rounded-lg border border-border bg-surface-container-lowest px-space-md py-space-sm text-body-md text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </OptionField>

      <OptionField label="Certificate passphrase" hint="Required">
        <input
          data-testid="sign-passphrase"
          type="password"
          value={typeof options.passphrase === "string" ? options.passphrase : ""}
          onChange={(event) => onChange({ passphrase: event.target.value })}
          placeholder="Protects the signing key"
          className="w-full max-w-md rounded-lg border border-border bg-surface-container-lowest px-space-md py-space-sm text-body-md text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </OptionField>

      <p data-testid="sign-note" className="text-body-sm text-muted-foreground">
        The document is signed with a real cryptographic signature — a self-signed
        certificate is generated for this run and protected by the passphrase you
        set. A visible stamp with your name and the signing time is drawn on the
        first page. Organisations that issue certificates can supply their own
        through the API.
      </p>
    </div>
  );
}

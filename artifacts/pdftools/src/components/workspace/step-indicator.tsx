import { uiIcons } from "@/lib/icons";
import { cn } from "@/lib/utils";

export type StepStatus = "complete" | "active" | "queued";

/**
 * The three-step indicator that heads both templates.
 *
 * Exactly the reference's three card states:
 *   complete  surface-container-low, 32px `bg-success` check, `text-success` label
 *   active    elevated card with shadow, 32px `primary-container` number, primary label
 *   queued    60% opacity, `surface-container` number, muted label
 */
export function StepIndicator({
  steps,
}: {
  steps: Array<{ status: StepStatus; eyebrow: string; label: string }>;
}) {
  return (
    <div className="w-full rounded-xl bg-surface-container-lowest p-space-md shadow-level-2">
      <div className="grid grid-cols-1 gap-space-sm md:grid-cols-3">
        {steps.map((step, index) => {
          const isComplete = step.status === "complete";
          const isActive = step.status === "active";

          return (
            <div
              key={step.eyebrow}
              data-testid={`stepper-step-${index + 1}`}
              data-status={step.status}
              className={cn(
                "flex items-center gap-space-md rounded-lg p-space-sm transition-all",
                isComplete && "bg-surface-container-low",
                isActive && "bg-surface-container-lowest shadow-level-3",
                step.status === "queued" && "opacity-60",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  isComplete && "bg-success text-surface-container-lowest",
                  isActive && "bg-primary-container text-label-md text-on-primary-container",
                  step.status === "queued" &&
                    "bg-surface-container text-label-md text-muted-foreground",
                )}
              >
                {isComplete ? (
                  <uiIcons.check className="h-[18px] w-[18px]" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              <div className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    "text-label-sm font-medium uppercase tracking-wider",
                    isComplete && "text-success",
                    /* `-foreground` variant: the fill token is only 3.67:1 as
                       text on a dark surface, so it inverts in dark mode. */
                    isActive && "text-primary-container-foreground",
                    step.status === "queued" && "text-muted-foreground",
                  )}
                >
                  {step.eyebrow}
                </span>
                <span
                  className={cn(
                    "truncate text-label-md",
                    isComplete && "text-foreground",
                    isActive && "font-semibold text-foreground",
                    step.status === "queued" && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

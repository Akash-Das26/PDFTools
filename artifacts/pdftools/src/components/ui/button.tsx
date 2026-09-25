import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — built to the reference's component spec (DESIGN.md §Components):
 *
 *   Primary:      bg primary, on-primary text, label-md, rounded-lg,
 *                 hover primary-hover, active scale 0.98, 2px offset ring.
 *   Secondary:    surface-matched background, 1px border, foreground text.
 *   Destructive:  destructive text, tinted background on hover.
 *
 * Rewritten from the vendored shadcn copy because that copy relied on Replit's
 * `hover-elevate` utilities and an undefined `--button-outline` variable.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-label-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary hover:bg-primary-hover",
        secondary:
          "border border-border bg-background text-foreground hover:bg-surface-container",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-container",
        ghost: "border border-transparent text-foreground hover:bg-surface-container",
        destructive:
          "border border-destructive-border bg-destructive text-destructive-foreground hover:bg-destructive-hover",
        subtledestructive:
          "border border-transparent text-destructive hover:bg-destructive/10",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-space-md",
        sm: "h-8 px-3 text-label-sm",
        lg: "h-12 px-space-lg text-body-md",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

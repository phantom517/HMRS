import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-[var(--ink-border-strong)] bg-[var(--paper)] px-3.5 py-2 text-sm text-[var(--ink)] transition-colors outline-none placeholder:text-[var(--ink-tertiary)] hover:border-[var(--ink-secondary)] focus-visible:border-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--ink)]/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[var(--linen)] disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      {...props}
    />
  )
}

export { Input }

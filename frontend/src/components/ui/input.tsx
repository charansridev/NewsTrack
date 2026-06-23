import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-2xl border border-white/30 bg-white/10 backdrop-blur-md px-3 py-2 text-base text-white shadow-sm transition-all outline-none selection:bg-white selection:text-primary file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white placeholder:text-white/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-white focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:bg-white/20 focus-visible:shadow-[0_4px_14px_0_rgba(255,255,255,0.15)]",
        "aria-invalid:border-error aria-invalid:ring-error/50",
        className
      )}
      {...props}
    />
  )
}

export { Input }

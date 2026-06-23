import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 active:scale-95 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-error/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-primary to-primary-container text-white hover:brightness-110 hover:shadow-[0_4px_14px_0_rgba(0,112,235,0.2)]",
        destructive:
          "bg-gradient-to-r from-error to-error-container text-white hover:brightness-110 hover:shadow-[0_4px_14px_0_rgba(186,26,26,0.2)] focus-visible:ring-error/20",
        outline:
          "bg-white/10 backdrop-blur-md border border-white/30 text-white hover:bg-white/20 shadow-sm",
        secondary:
          "bg-white border border-white/30 text-primary hover:bg-white/90 shadow-sm",
        ghost:
          "text-white/80 hover:bg-white/10 hover:text-white",
        link: "text-white underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-7 gap-1 rounded px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded px-3 has-[>svg]:px-2.5",
        lg: "h-12 rounded px-8 has-[>svg]:px-6",
        icon: "size-10",
        "icon-xs": "size-7 rounded [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

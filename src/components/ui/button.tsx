import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-ink text-cream hover:bg-ink-2 [a]:hover:bg-ink-2",
        accent:
          "bg-terracotta text-cream hover:bg-terracotta-dark [a]:hover:bg-terracotta-dark",
        outline:
          "border-line bg-transparent text-ink hover:bg-paper-2 hover:text-ink aria-expanded:bg-paper-2",
        secondary:
          "bg-paper-2 text-ink hover:bg-paper-3 aria-expanded:bg-paper-3",
        ghost:
          "text-ink hover:bg-paper-2 aria-expanded:bg-paper-2",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/30",
        link:
          "text-terracotta underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 gap-2 px-5 text-sm",
        xs: "h-7 gap-1 px-3 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-4 text-[0.85rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-7 text-[15px]",
        xl: "h-14 gap-2.5 px-9 text-base",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
      shape: {
        pill: "rounded-full",
        square: "rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "pill",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  shape,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, shape, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

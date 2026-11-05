import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "relative shimmer overflow-hidden rounded-lg bg-muted",
        className
      )}
      {...props}
    />
  )
}

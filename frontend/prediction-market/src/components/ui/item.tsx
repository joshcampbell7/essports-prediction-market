import * as React from "react"
import { cn } from "@/lib/utils"

const Item = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    variant?: "default" | "muted"
  }
>(({ className, variant = "default", ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3",
        variant === "muted" && "bg-muted/50",
        className
      )}
      {...props}
    />
  )
})
Item.displayName = "Item"

const ItemMedia = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex-shrink-0", className)}
      {...props}
    />
  )
})
ItemMedia.displayName = "ItemMedia"

const ItemContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    className?: string
  }
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex-1", className)}
      {...props}
    />
  )
})
ItemContent.displayName = "ItemContent"

const ItemTitle = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("font-medium", className)}
      {...props}
    />
  )
})
ItemTitle.displayName = "ItemTitle"

export { Item, ItemMedia, ItemContent, ItemTitle }




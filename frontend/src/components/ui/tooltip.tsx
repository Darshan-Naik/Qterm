import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { PortalZoom } from "@/lib/portalZoom"
import { cn } from "@/lib/utils"

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className="z-50 bg-transparent p-0 shadow-none outline-none"
        {...props}
      >
        <PortalZoom
          className={cn(
            "overflow-hidden rounded-md border border-border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-md",
            className
          )}
        >
          {children}
        </PortalZoom>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

/** Wrap an interactive control with a Radix tooltip (replaces native `title`). */
export function WithTooltip({
  label,
  side = "bottom",
  children,
  disabled,
  sideOffset,
}: {
  label: React.ReactNode
  side?: React.ComponentProps<typeof TooltipPrimitive.Content>["side"]
  children: React.ReactElement
  /** Force closed without unmounting (keeps DropdownMenuTrigger anchor stable). */
  disabled?: boolean
  sideOffset?: number
}) {
  if (label == null || label === "") return children
  return (
    <Tooltip open={disabled ? false : undefined}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={sideOffset}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

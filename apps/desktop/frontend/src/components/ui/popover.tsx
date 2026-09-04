import type { ComponentProps } from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { PortalZoom } from "@/lib/portalZoom"
import { cn } from "@/lib/utils"

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor

export function PopoverContent({
  className,
  align = "end",
  sideOffset = 4,
  children,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={10}
        className="motion-popover z-50 bg-transparent p-0 shadow-none outline-none"
        {...props}
      >
        <PortalZoom
          className={cn(
            "w-[26rem] max-h-[min(70vh,34rem)] overflow-hidden rounded-lg border border-border/80 bg-popover text-popover-foreground shadow-xl",
            className
          )}
        >
          {children}
        </PortalZoom>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

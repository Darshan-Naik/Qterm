import type { ComponentProps } from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { PortalZoom } from "@/lib/portalZoom"
import { cn } from "@/lib/utils"

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger

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
        className="z-50 bg-transparent p-0 shadow-none outline-none"
        {...props}
      >
        <PortalZoom
          className={cn(
            "w-80 max-h-[min(70vh,32rem)] overflow-hidden rounded-md bg-popover text-popover-foreground shadow-xl",
            className
          )}
        >
          {children}
        </PortalZoom>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

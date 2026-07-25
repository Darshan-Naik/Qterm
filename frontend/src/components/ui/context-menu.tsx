import * as ContextMenuPrimitive from "@radix-ui/react-context-menu"
import { cn } from "@/lib/utils"

export const ContextMenu = ContextMenuPrimitive.Root
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger

export function ContextMenuContent({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          "z-50 min-w-[11rem] overflow-hidden rounded-md bg-popover p-1.5 text-popover-foreground shadow-xl",
          className
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
}

export function ContextMenuItem({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Item>) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-[13px] outline-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export function ContextMenuSeparator({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return <ContextMenuPrimitive.Separator className={cn("-mx-1 my-1.5 h-px bg-secondary", className)} {...props} />
}

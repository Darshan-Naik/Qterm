import * as ContextMenuPrimitive from "@radix-ui/react-context-menu"
import { PortalZoom } from "@/lib/portalZoom"
import { cn } from "@/lib/utils"

export const ContextMenu = ContextMenuPrimitive.Root
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger

export function ContextMenuContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className="z-50 bg-transparent p-0 shadow-none outline-none"
        {...props}
      >
        <PortalZoom
          className={cn(
            "min-w-[11rem] overflow-hidden rounded-md bg-popover p-1.5 text-popover-foreground shadow-xl",
            className
          )}
        >
          {children}
        </PortalZoom>
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  )
}

export function ContextMenuItem({
  className,
  shortcut,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & { shortcut?: string }) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-[13px] outline-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {shortcut ? (
        <span className="ml-3 shrink-0 text-[11px] tabular-nums tracking-wide text-muted-foreground">
          {shortcut}
        </span>
      ) : null}
    </ContextMenuPrimitive.Item>
  )
}

export function ContextMenuSeparator({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return <ContextMenuPrimitive.Separator className={cn("-mx-1 my-1.5 h-px bg-secondary", className)} {...props} />
}

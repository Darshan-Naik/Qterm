import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn("motion-dialog-overlay fixed inset-0 z-50 bg-black/40", className)}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  position = "center",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  /** `top` = Spotlight-style (command / quick open). */
  position?: "center" | "top";
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay
        className={cn(
          position === "center" && "motion-dialog-overlay",
          position === "top"
            ? "bg-background/40 backdrop-blur-md supports-[backdrop-filter]:bg-background/25"
            : undefined
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 gap-4 rounded-lg bg-popover p-5 text-popover-foreground shadow-xl outline-none",
          position === "center" && "motion-dialog-content top-1/2 grid -translate-y-1/2",
          position === "top" &&
            "top-[max(5.5rem,20vh)] flex max-h-[calc(100vh-max(5.5rem,20vh)-20vh)] translate-y-0 flex-col overflow-hidden",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 cursor-pointer rounded-md p-1.5 opacity-70 hover:bg-accent hover:opacity-100">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 text-left pr-6", className)} {...props} />
}
export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-[15px] font-medium tracking-tight", className)} {...props} />
}
export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-[13px] text-muted-foreground", className)} {...props} />
}

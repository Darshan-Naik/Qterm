import * as LabelPrimitive from "@radix-ui/react-label"
import { cn } from "@/lib/utils"

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn("text-[13px] font-normal leading-none", className)} {...props} />
}

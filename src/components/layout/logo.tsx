import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function Logo({ className, size = "md" }: LogoProps) {
  const sizes = {
    sm: { box: "w-7 h-7 text-xs rounded-lg", text: "text-base" },
    md: { box: "w-9 h-9 text-sm rounded-xl", text: "text-lg" },
    lg: { box: "w-12 h-12 text-base rounded-2xl", text: "text-2xl" },
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "bg-primary text-primary-foreground font-bold flex items-center justify-center leading-none",
          sizes[size].box
        )}
      >
        <span className="flex flex-col items-center">
          <span>ZE</span>
          <span>LO</span>
        </span>
      </div>
      <span className={cn("font-semibold text-foreground", sizes[size].text)}>
        Zelo<span className="text-primary">H</span>
      </span>
    </div>
  )
}

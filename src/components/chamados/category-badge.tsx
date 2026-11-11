import { cn } from "@/lib/utils"

const categoryStyles: Record<string, string> = {
  Hidráulica:     "bg-blue-100 text-blue-700",
  Elétrica:       "bg-yellow-100 text-yellow-700",
  Infraestrutura: "bg-gray-100 text-gray-600",
  Convivência:    "bg-pink-100 text-pink-700",
  Manutenção:     "bg-orange-100 text-orange-700",
  Preventiva:     "bg-green-100 text-green-700",
  Corretiva:      "bg-red-100 text-red-700",
  Administrativa: "bg-purple-100 text-purple-700",
  Segurança:      "bg-slate-100 text-slate-700",
}

interface CategoryBadgeProps {
  category: string
  className?: string
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const style = categoryStyles[category] ?? "bg-muted text-muted-foreground"
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold",
        style,
        className
      )}
    >
      {category}
    </span>
  )
}

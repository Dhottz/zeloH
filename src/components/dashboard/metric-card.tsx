import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  trend?: { label: string; positive?: boolean }
  className?: string
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("p-4 flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-heading font-bold text-foreground leading-none">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium",
              trend.positive ? "text-green-600" : "text-muted-foreground"
            )}
          >
            {trend.label}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      )}
    </Card>
  )
}

"use client"

import { Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ZiaSuggestionProps {
  message: string
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
  className?: string
}

export function ZiaSuggestion({ message, action, onDismiss, className }: ZiaSuggestionProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold text-primary">Zia · assistente</span>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <p className="text-sm text-foreground leading-relaxed">{message}</p>
      {action && (
        <div className="flex gap-2">
          <Button size="sm" className="text-xs h-7" onClick={action.onClick}>
            {action.label}
          </Button>
          {onDismiss && (
            <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground" onClick={onDismiss}>
              Ignorar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

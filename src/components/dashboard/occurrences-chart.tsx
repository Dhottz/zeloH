"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface DayCount { day: string; value: number }

const categories = [
  { label: "Aberto",       color: "bg-primary/70" },
  { label: "Em andamento", color: "bg-yellow-400" },
  { label: "Concluído",    color: "bg-green-400" },
]

interface OccurrencesChartProps {
  condominioId?: string
}

export function OccurrencesChart({ condominioId }: OccurrencesChartProps) {
  const [data, setData] = useState<DayCount[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!condominioId) return
    fetch(`/api/chamados/chart?condominioId=${condominioId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.porDia ?? [])
        setTotal(d.total ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [condominioId])

  const max = Math.max(...data.map((d) => d.value), 1)

  if (loading) {
    return (
      <Card className="p-4 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-4 w-20" />
      </Card>
    )
  }

  return (
    <Card className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ocorrências</p>
          <p className="text-xs text-muted-foreground mt-0.5">últimos 14 dias</p>
        </div>
        <div className="flex items-center gap-3">
          {categories.map((c) => (
            <div key={c.label} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${c.color}`} />
              <span className="text-[10px] text-muted-foreground">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-28 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">Nenhuma ocorrência nos últimos 14 dias</p>
        </div>
      ) : (
        <div className="flex items-end gap-1.5 h-28">
          {data.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm bg-primary/70 transition-all"
                style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? "4px" : "0" }}
              />
              <span className="text-[9px] text-muted-foreground whitespace-nowrap">{d.day}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <span className="text-2xl font-heading font-bold">{total}</span>
        <span className="text-xs text-muted-foreground">registradas</span>
      </div>
    </Card>
  )
}

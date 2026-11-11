"use client"

import { useState, useEffect, useCallback } from "react"
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay,
  DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { KanbanColumn } from "./kanban-column"
import { KanbanCard } from "./kanban-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChamadoDetalheModal } from "./chamado-detalhe-modal"
import { CategoryBadge } from "./category-badge"
import { STATUS_OPTIONS, inferirCategoria } from "./kanban-card"
import { formatDateTime, cn } from "@/lib/utils"
import { ChevronDown, Check } from "lucide-react"
import type { Chamado, ChamadoStatus } from "@/types/chamado"

type ColumnId = "ABERTO" | "EM_ANDAMENTO" | "AGUARDANDO_PRESTADOR" | "CONCLUIDO"

interface Column { id: ColumnId; title: string; color: string }

const COLUMNS: Column[] = [
  { id: "ABERTO",               title: "Aberto",              color: "bg-gray-400" },
  { id: "EM_ANDAMENTO",         title: "Em andamento",        color: "bg-yellow-400" },
  { id: "AGUARDANDO_PRESTADOR", title: "Aguard. prestador",   color: "bg-orange-400" },
  { id: "CONCLUIDO",            title: "Concluído",           color: "bg-green-400" },
]

const prioridadeColor: Record<string, string> = {
  BAIXA:   "bg-gray-100 text-gray-700",
  MEDIA:   "bg-yellow-100 text-yellow-700",
  ALTA:    "bg-orange-100 text-orange-700",
  URGENTE: "bg-red-100 text-red-700",
}

type ColunaMap = Record<ColumnId, Chamado[]>

interface FiltrosChamados {
  busca?: string
  prioridade?: string
  arquivados?: boolean
}

interface KanbanBoardProps {
  onNovaOcorrencia?: () => void
  view?: "kanban" | "list"
  filtros?: FiltrosChamados
}

export function KanbanBoard({ onNovaOcorrencia, view = "kanban", filtros }: KanbanBoardProps) {
  const [columns, setColumns] = useState<ColunaMap>({
    ABERTO: [], EM_ANDAMENTO: [], AGUARDANDO_PRESTADOR: [], CONCLUIDO: [],
  })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeOriginalCol, setActiveOriginalCol] = useState<ColumnId | null>(null)
  const [chamadoAberto, setChamadoAberto] = useState<Chamado | null>(null)
  const [loading, setLoading] = useState(true)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const fetchChamados = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filtros?.busca)       params.set("busca",      filtros.busca)
      if (filtros?.prioridade)  params.set("prioridade", filtros.prioridade)
      if (filtros?.arquivados)  params.set("status",     "ARQUIVADO")
      const qs = params.toString()
      const res = await fetch(`/api/chamados${qs ? `?${qs}` : ""}`)
      if (!res.ok) return
      const data = await res.json()
      setColumns({
        ABERTO:               data.agrupado.ABERTO               ?? [],
        EM_ANDAMENTO:         data.agrupado.EM_ANDAMENTO         ?? [],
        AGUARDANDO_PRESTADOR: data.agrupado.AGUARDANDO_PRESTADOR ?? [],
        CONCLUIDO:            data.agrupado.CONCLUIDO            ?? [],
      })
    } catch (err) {
      console.error("[KanbanBoard] fetch error", err)
    } finally {
      setLoading(false)
    }
  }, [filtros?.busca, filtros?.prioridade, filtros?.arquivados])

  useEffect(() => { fetchChamados() }, [fetchChamados])

  function findColumn(id: string): ColumnId | null {
    for (const [col, items] of Object.entries(columns)) {
      if ((items as Chamado[]).find((i) => i.id === id)) return col as ColumnId
    }
    return null
  }

  function findChamado(id: string): Chamado | undefined {
    for (const items of Object.values(columns)) {
      const found = (items as Chamado[]).find((i) => i.id === id)
      if (found) return found
    }
  }

  // Muda status via dropdown (card ou lista) e persiste
  const handleStatusChange = useCallback(async (chamadoId: string, newStatus: ChamadoStatus) => {
    const originCol = findColumn(chamadoId)
    const destCol   = COLUMNS.find((c) => c.id === newStatus)?.id ?? null

    if (!originCol || !destCol || originCol === destCol) return

    const chamado = findChamado(chamadoId)
    if (!chamado) return

    // Optimistic update
    setColumns((prev) => ({
      ...prev,
      [originCol]: prev[originCol].filter((c) => c.id !== chamadoId),
      [destCol]:   [...prev[destCol], { ...chamado, status: newStatus }],
    }))

    try {
      const res = await fetch(`/api/chamados/${chamadoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) fetchChamados()
    } catch {
      fetchChamados()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns])

  function onDragStart({ active }: DragStartEvent) {
    const col = findColumn(active.id as string)
    setActiveId(active.id as string)
    setActiveOriginalCol(col)
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const activeCol = findColumn(active.id as string)
    const overCol = (COLUMNS.find((c) => c.id === over.id)
      ? over.id
      : findColumn(over.id as string)) as ColumnId | null

    if (!activeCol || !overCol || activeCol === overCol) return

    setColumns((prev) => {
      const item = prev[activeCol].find((i) => i.id === active.id)!
      return {
        ...prev,
        [activeCol]: prev[activeCol].filter((i) => i.id !== active.id),
        [overCol]: [...prev[overCol], { ...item, status: overCol as ChamadoStatus }],
      }
    })
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    // originCol = coluna original ANTES do onDragOver mover o card
    const originCol = activeOriginalCol
    setActiveOriginalCol(null)

    if (!over || !originCol) return

    const overCol = (COLUMNS.find((c) => c.id === over.id)
      ? over.id
      : findColumn(over.id as string)) as ColumnId | null

    if (!overCol) return

    // Reordena dentro da mesma coluna
    if (originCol === overCol) {
      const currentCol = findColumn(active.id as string) ?? originCol
      const oldIdx = columns[currentCol].findIndex((i) => i.id === active.id)
      const newIdx = columns[overCol].findIndex((i) => i.id === over.id)
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        setColumns((prev) => ({
          ...prev,
          [currentCol]: arrayMove(prev[currentCol], oldIdx, newIdx),
        }))
      }
      return
    }

    // Persiste mudança de coluna no banco
    try {
      const res = await fetch(`/api/chamados/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: overCol }),
      })
      if (!res.ok) fetchChamados()
    } catch {
      fetchChamados()
    }
  }

  const activeChamado = activeId ? findChamado(activeId) : null
  const todosOrdenados = Object.values(columns).flat().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  if (loading) {
    return (
      <div className="flex gap-4">
        {COLUMNS.map((col) => (
          <div key={col.id} className="flex-1 space-y-2">
            <Skeleton className="h-5 w-24" />
            <div className="bg-muted/40 rounded-xl p-2 space-y-2 min-h-[200px]">
              {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (view === "list") {
    if (todosOrdenados.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-sm text-muted-foreground">
          <p>Nenhuma ocorrência encontrada.</p>
        </div>
      )
    }
    return (
      <>
        <div className="space-y-2 overflow-y-auto h-full">
          {todosOrdenados.map((c) => {
            const iniciais = c.morador.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("")
            const currentStatus = STATUS_OPTIONS.find((s) => s.value === c.status)
            const localizacao = [
              c.morador.bloco && `Bloco ${c.morador.bloco}`,
              c.morador.unidade && `Apto ${c.morador.unidade}`,
            ].filter(Boolean).join(" · ")
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition-colors cursor-pointer"
                onClick={() => setChamadoAberto(c)}
              >
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">{iniciais}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.morador.nome}{localizacao ? ` · ${localizacao}` : ""} · {formatDateTime(c.createdAt)}
                  </p>
                </div>
                <div
                  className="flex items-center gap-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <CategoryBadge category={inferirCategoria(c.titulo)} />
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold", prioridadeColor[c.prioridade])}>
                    {c.prioridade}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors hover:opacity-80",
                      currentStatus?.color ?? "bg-muted text-muted-foreground"
                    )}>
                      {currentStatus?.label ?? c.status}
                      <ChevronDown className="w-2.5 h-2.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {STATUS_OPTIONS.map((opt) => (
                        <DropdownMenuItem
                          key={opt.value}
                          onClick={() => handleStatusChange(c.id, opt.value)}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold", opt.color)}>
                            {opt.label}
                          </span>
                          {c.status === opt.value && <Check className="w-3 h-3 text-primary" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
        <ChamadoDetalheModal
          chamado={chamadoAberto}
          open={!!chamadoAberto}
          onClose={() => setChamadoAberto(null)}
          onStatusChange={(id, status) => { handleStatusChange(id, status); setChamadoAberto(null) }}
        />
      </>
    )
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 h-full overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              color={col.color}
              chamados={columns[col.id]}
              onNovaOcorrencia={col.id === "ABERTO" ? onNovaOcorrencia : undefined}
              onStatusChange={handleStatusChange}
              onOpen={setChamadoAberto}
            />
          ))}
        </div>
        <DragOverlay>
          {activeChamado && <KanbanCard chamado={activeChamado} />}
        </DragOverlay>
      </DndContext>
      <ChamadoDetalheModal
        chamado={chamadoAberto}
        open={!!chamadoAberto}
        onClose={() => setChamadoAberto(null)}
        onStatusChange={(id, status) => { handleStatusChange(id, status); setChamadoAberto(null) }}
      />
    </>
  )
}

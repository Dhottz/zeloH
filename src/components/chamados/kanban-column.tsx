"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Plus } from "lucide-react"
import { KanbanCard } from "./kanban-card"
import { cn } from "@/lib/utils"
import type { Chamado } from "@/types/chamado"

interface KanbanColumnProps {
  id: string
  title: string
  chamados: Chamado[]
  color?: string
  onNovaOcorrencia?: () => void
  onStatusChange?: (id: string, status: import("@/types/chamado").ChamadoStatus) => void
  onOpen?: (chamado: Chamado) => void
}

export function KanbanColumn({ id, title, chamados, color, onNovaOcorrencia, onStatusChange, onOpen }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div className="flex flex-col gap-2 min-w-0 flex-1">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {color && <span className={cn("w-2 h-2 rounded-full", color)} />}
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground font-medium">{chamados.length}</span>
        </div>
        {id === "ABERTO" && onNovaOcorrencia && (
          <button
            onClick={onNovaOcorrencia}
            className="p-0.5 rounded hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-2 min-h-[120px] rounded-xl p-2 transition-colors",
          isOver ? "bg-primary/5 border border-dashed border-primary/30" : "bg-muted/40"
        )}
      >
        <SortableContext items={chamados.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {chamados.map((chamado) => (
            <KanbanCard key={chamado.id} chamado={chamado} onStatusChange={onStatusChange} onOpen={onOpen} />
          ))}
        </SortableContext>
        {chamados.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-4">
            <p className="text-xs text-muted-foreground">Sem itens</p>
          </div>
        )}
      </div>
    </div>
  )
}

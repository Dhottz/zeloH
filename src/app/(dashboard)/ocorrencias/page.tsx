"use client"

import { useState, useRef } from "react"
import { KanbanBoard } from "@/components/chamados/kanban-board"
import { NovaOcorrenciaModal } from "@/components/chamados/nova-ocorrencia-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LayoutGrid, List, SlidersHorizontal, Plus, X, Archive } from "lucide-react"
import { cn } from "@/lib/utils"

const PRIORIDADES = [
  { value: "BAIXA",   label: "Baixa",   color: "bg-gray-100 text-gray-700" },
  { value: "MEDIA",   label: "Média",   color: "bg-yellow-100 text-yellow-700" },
  { value: "ALTA",    label: "Alta",    color: "bg-orange-100 text-orange-700" },
  { value: "URGENTE", label: "Urgente", color: "bg-red-100 text-red-700" },
]

export default function OcorrenciasPage() {
  const [modalAberto, setModalAberto]       = useState(false)
  const [view, setView]                     = useState<"kanban" | "list">("kanban")
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [busca, setBusca]                   = useState("")
  const [prioridade, setPrioridade]         = useState("")
  const [arquivados, setArquivados]         = useState(false)
  const refreshRef = useRef<(() => void) | null>(null)

  function handleCriado() {
    refreshRef.current?.()
  }

  const filtrosAtivos = !!(busca || prioridade)

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Ocorrências</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie e acompanhe todas as ocorrências do condomínio
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle — hidden in arquivados mode */}
          {!arquivados && (
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setView("kanban")}
                className={cn(
                  "p-2 border-r border-border transition-colors",
                  view === "kanban" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/60"
                )}
                title="Visualização Kanban"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setView("list")}
                className={cn(
                  "p-2 transition-colors",
                  view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/60"
                )}
                title="Visualização em lista"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Filtros toggle — hidden in arquivados mode */}
          {!arquivados && (
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-1.5 text-xs", filtrosAtivos && "border-primary text-primary")}
              onClick={() => setFiltrosAbertos((v) => !v)}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtros
              {filtrosAtivos && (
                <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Button>
          )}

          {/* Arquivados toggle */}
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1.5 text-xs", arquivados && "border-primary bg-primary/5 text-primary")}
            onClick={() => {
              setArquivados((v) => !v)
              setFiltrosAbertos(false)
            }}
          >
            <Archive className="w-3.5 h-3.5" />
            Arquivados
          </Button>

          {/* Nova ocorrência — hidden in arquivados mode */}
          {!arquivados && (
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => setModalAberto(true)}>
              <Plus className="w-3.5 h-3.5" />
              Nova ocorrência
            </Button>
          )}
        </div>
      </div>

      {/* Painel de filtros */}
      {filtrosAbertos && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/30">
          <Input
            placeholder="Buscar por título..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-8 text-xs w-56"
          />

          <div className="flex gap-1.5">
            {PRIORIDADES.map((p) => (
              <button
                key={p.value}
                onClick={() => setPrioridade(prioridade === p.value ? "" : p.value)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border",
                  prioridade === p.value
                    ? `${p.color} border-current`
                    : "border-border text-muted-foreground hover:text-foreground bg-background"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {filtrosAtivos && (
            <button
              onClick={() => { setBusca(""); setPrioridade("") }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Kanban / Lista */}
      <div className="flex-1 min-h-0">
        <KanbanBoard
          onNovaOcorrencia={() => setModalAberto(true)}
          view={arquivados ? "list" : view}
          filtros={{ busca, prioridade, arquivados }}
        />
      </div>

      {/* Modal */}
      <NovaOcorrenciaModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        onCriado={handleCriado}
      />
    </div>
  )
}

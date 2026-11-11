"use client"

import { useEffect, useState } from "react"
import { Megaphone, Pin, ChevronDown, ChevronUp, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

type ComunicadoTipo = "AVISO" | "URGENTE" | "MANUTENCAO" | "EVENTO" | "OUTRO"

interface Comunicado {
  id: string
  titulo: string
  conteudo: string
  tipo: ComunicadoTipo
  fixado: boolean
  createdAt: string
  expiraEm: string | null
  autor: { nome: string }
}

// ─── Config ──────────────────────────────────────────────────────────────────

const TIPO_COLOR: Record<ComunicadoTipo, string> = {
  AVISO:      "bg-blue-50 text-blue-700 border-blue-200",
  URGENTE:    "bg-red-50 text-red-700 border-red-200",
  MANUTENCAO: "bg-orange-50 text-orange-700 border-orange-200",
  EVENTO:     "bg-purple-50 text-purple-700 border-purple-200",
  OUTRO:      "bg-gray-50 text-gray-700 border-gray-200",
}

const TIPO_LABEL: Record<ComunicadoTipo, string> = {
  AVISO:      "Aviso",
  URGENTE:    "Urgente",
  MANUTENCAO: "Manutenção",
  EVENTO:     "Evento",
  OUTRO:      "Outro",
}

const TIPO_TABS: Array<{ value: ComunicadoTipo | "TODOS"; label: string }> = [
  { value: "TODOS",      label: "Todos" },
  { value: "AVISO",      label: "Avisos" },
  { value: "URGENTE",    label: "Urgentes" },
  { value: "MANUTENCAO", label: "Manutenção" },
  { value: "EVENTO",     label: "Eventos" },
]

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function ComunicadoCard({ c }: { c: Comunicado }) {
  const [expandido, setExpandido] = useState(false)

  return (
    <div className={cn(
      "bg-background rounded-2xl border border-border overflow-hidden transition-shadow",
      c.tipo === "URGENTE" && "border-red-200",
    )}>
      <button
        className="w-full text-left p-4"
        onClick={() => setExpandido((v) => !v)}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <Badge className={cn("text-[10px] border", TIPO_COLOR[c.tipo])}>
                {TIPO_LABEL[c.tipo]}
              </Badge>
              {c.fixado && (
                <Badge className="text-[10px] border bg-gray-50 text-gray-600 border-gray-200 flex items-center gap-0.5">
                  <Pin className="w-2.5 h-2.5" /> Fixado
                </Badge>
              )}
            </div>
            <p className="font-semibold text-sm text-foreground leading-snug">{c.titulo}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {c.autor.nome} · {fmtData(c.createdAt)}
            </p>
          </div>
          <span className="text-muted-foreground mt-0.5 shrink-0">
            {expandido
              ? <ChevronUp className="w-4 h-4" />
              : <ChevronDown className="w-4 h-4" />
            }
          </span>
        </div>
      </button>

      {expandido && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {c.conteudo}
          </p>
          {c.expiraEm && (
            <p className="text-xs text-muted-foreground mt-3">
              Válido até {fmtData(c.expiraEm)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MoradorComunicadosPage() {
  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [loading, setLoading]         = useState(true)
  const [busca, setBusca]             = useState("")
  const [tipoFiltro, setTipoFiltro]   = useState<ComunicadoTipo | "TODOS">("TODOS")

  useEffect(() => {
    const params = new URLSearchParams({ publicado: "true" })
    if (tipoFiltro !== "TODOS") params.set("tipo", tipoFiltro)
    if (busca.trim()) params.set("busca", busca.trim())

    setLoading(true)
    fetch(`/api/comunicados?${params}`)
      .then((r) => {
        if (!r.headers.get("content-type")?.includes("application/json")) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => setComunicados(d.comunicados ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [tipoFiltro, busca])

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-background sticky top-0 z-10 border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <Megaphone className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold font-heading">Comunicados</h1>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar comunicado..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-9 text-sm rounded-xl"
          />
        </div>

        {/* Tipo tabs */}
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5 no-scrollbar">
          {TIPO_TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTipoFiltro(value)}
              className={cn(
                "shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                tipoFiltro === value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/40"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-background rounded-2xl border border-border p-4 animate-pulse">
              <div className="h-3 bg-muted rounded w-16 mb-2" />
              <div className="h-4 bg-muted rounded w-3/4 mb-1" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))
        ) : comunicados.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Megaphone className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum comunicado encontrado</p>
          </div>
        ) : (
          comunicados.map((c) => <ComunicadoCard key={c.id} c={c} />)
        )}
      </div>
    </div>
  )
}

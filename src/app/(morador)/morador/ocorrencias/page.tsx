"use client"

import { useEffect, useState, useCallback } from "react"
import {
  AlertCircle, Plus, Loader2, Clock,
  CheckCircle2, XCircle, Zap, ChevronDown, ChevronUp, Star, MapPin,
} from "lucide-react"
import { toast } from "sonner"
import { ArquivosInput, GaleriaArquivos } from "@/components/shared/arquivos-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

type ChamadoStatus    = "ABERTO" | "EM_ANDAMENTO" | "AGUARDANDO_PRESTADOR" | "CONCLUIDO" | "CANCELADO"
type ChamadoPrioridade = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE"

interface Chamado {
  id: string
  titulo: string
  descricao: string | null
  status: ChamadoStatus
  prioridade: ChamadoPrioridade
  createdAt: string
  resolvidoEm: string | null
  local?: string | null
  fotos?: string[]
  avaliacaoNota?: number | null
  avaliacaoComentario?: string | null
  morador: { id: string; nome: string; unidade: string | null }
}

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ChamadoStatus, { label: string; color: string; icon: React.ReactNode }> = {
  ABERTO:               { label: "Aberto",            color: "bg-blue-50 text-blue-700 border-blue-200",     icon: <Clock         className="h-3 w-3" /> },
  EM_ANDAMENTO:         { label: "Em andamento",       color: "bg-amber-50 text-amber-700 border-amber-200",  icon: <Loader2       className="h-3 w-3" /> },
  AGUARDANDO_PRESTADOR: { label: "Aguard. prestador",  color: "bg-purple-50 text-purple-700 border-purple-200",icon: <Clock        className="h-3 w-3" /> },
  CONCLUIDO:            { label: "Concluído",           color: "bg-green-50 text-green-700 border-green-200",  icon: <CheckCircle2 className="h-3 w-3" /> },
  CANCELADO:            { label: "Cancelado",           color: "bg-gray-50 text-gray-600 border-gray-200",     icon: <XCircle      className="h-3 w-3" /> },
}

const PRIOR_CONFIG: Record<ChamadoPrioridade, { label: string; color: string }> = {
  BAIXA:   { label: "Baixa",   color: "bg-gray-50 text-gray-600 border-gray-200" },
  MEDIA:   { label: "Média",   color: "bg-blue-50 text-blue-700 border-blue-200" },
  ALTA:    { label: "Alta",    color: "bg-orange-50 text-orange-700 border-orange-200" },
  URGENTE: { label: "Urgente", color: "bg-red-50 text-red-700 border-red-200" },
}

function fmtRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h    = Math.floor(diff / 3600000)
  const d    = Math.floor(diff / 86400000)
  if (h < 1)  return "agora"
  if (h < 24) return `${h}h atrás`
  if (d < 7)  return `${d}d atrás`
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Avaliar({ c, onAvaliado }: { c: Chamado; onAvaliado: () => void }) {
  const [nota, setNota] = useState(0)
  const [comentario, setComentario] = useState("")
  const [enviando, setEnviando] = useState(false)

  if (c.avaliacaoNota) {
    return (
      <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={cn("w-3.5 h-3.5", i < c.avaliacaoNota! ? "fill-amber-400 text-amber-400" : "text-muted")} />
        ))}
        <span className="ml-1.5">Obrigado pela avaliação!</span>
      </div>
    )
  }

  const enviar = async () => {
    setEnviando(true)
    const res = await fetch(`/api/chamados/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avaliacaoNota: nota, avaliacaoComentario: comentario || null }),
    })
    setEnviando(false)
    if (res.ok) { toast.success("Avaliação enviada"); onAvaliado() }
    else toast.error("Não foi possível enviar a avaliação")
  }

  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
      <p className="text-xs font-medium text-amber-900">Como foi o atendimento?</p>
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <button key={i} type="button" onClick={() => setNota(i + 1)} aria-label={`${i + 1} estrelas`}>
            <Star className={cn("w-7 h-7", i < nota ? "fill-amber-400 text-amber-400" : "text-amber-200")} />
          </button>
        ))}
      </div>
      {nota > 0 && (
        <>
          <Input value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Comentário (opcional)" className="rounded-xl bg-background" />
          <Button size="sm" onClick={enviar} disabled={enviando} className="rounded-xl w-full">Enviar avaliação</Button>
        </>
      )}
    </div>
  )
}

function ChamadoCard({ c, onCancel, onAtualizado }: { c: Chamado; onCancel: (id: string) => void; onAtualizado: () => void }) {
  const [expandido, setExpandido] = useState(false)
  const sc = STATUS_CONFIG[c.status]
  const pc = PRIOR_CONFIG[c.prioridade]
  const ativo = !["CONCLUIDO", "CANCELADO"].includes(c.status)

  return (
    <div className="bg-background rounded-2xl border border-border overflow-hidden">
      <button className="w-full text-left p-4" onClick={() => setExpandido((v) => !v)}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <Badge className={cn("text-[10px] border flex items-center gap-1", sc.color)}>
                {sc.icon}{sc.label}
              </Badge>
              <Badge className={cn("text-[10px] border", pc.color)}>
                {pc.label}
              </Badge>
            </div>
            <p className="font-semibold text-sm text-foreground leading-snug">{c.titulo}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{fmtRelativo(c.createdAt)}</p>
          </div>
          <span className="text-muted-foreground mt-0.5 shrink-0">
            {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </div>
      </button>

      {expandido && (
        <div className="px-4 pb-4 border-t border-border pt-3 flex flex-col gap-3">
          {c.descricao ? (
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{c.descricao}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sem descrição adicional</p>
          )}

          {c.local && (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{c.local}</p>
          )}

          {!!c.fotos?.length && <GaleriaArquivos arquivos={c.fotos} tamanho="sm" />}

          {c.resolvidoEm && (
            <p className="text-xs text-green-700">
              ✓ Resolvido em {new Date(c.resolvidoEm).toLocaleDateString("pt-BR")}
            </p>
          )}

          {c.status === "CONCLUIDO" && <Avaliar c={c} onAvaliado={onAtualizado} />}

          {c.status === "ABERTO" && (
            <button
              onClick={() => onCancel(c.id)}
              className="w-full text-xs text-red-600 border border-red-200 bg-red-50 rounded-xl py-1.5 font-medium hover:bg-red-100 transition-colors"
            >
              Cancelar chamado
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PRIORIDADES: ChamadoPrioridade[] = ["BAIXA", "MEDIA", "ALTA", "URGENTE"]

export default function MoradorOcorrenciasPage() {
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState<"ATIVOS" | "TODOS">("ATIVOS")

  // Modal
  const [modalAberto, setModalAberto] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [erro, setErro]               = useState("")
  const [titulo, setTitulo]           = useState("")
  const [descricao, setDescricao]     = useState("")
  const [local, setLocal]             = useState("")
  const [fotos, setFotos]             = useState<string[]>([])
  const [prioridade, setPrioridade]   = useState<ChamadoPrioridade>("MEDIA")

  const carregar = useCallback(async () => {
    setLoading(true)
    const res  = await fetch("/api/chamados?minhas=true")
    const data = await res.json()
    setChamados(data.chamados ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function handleCriar() {
    if (!titulo.trim()) { setErro("Título obrigatório"); return }
    setSaving(true); setErro("")
    try {
      const res = await fetch("/api/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, descricao, prioridade, local: local || null, fotos }),
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.message ?? "Erro ao abrir chamado"); return }
      setModalAberto(false)
      setTitulo(""); setDescricao(""); setPrioridade("MEDIA"); setLocal(""); setFotos([])
      carregar()
    } catch {
      setErro("Erro ao abrir chamado")
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancelar este chamado?")) return
    await fetch(`/api/chamados/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELADO" }),
    })
    carregar()
  }

  const exibidos = filtro === "ATIVOS"
    ? chamados.filter((c) => !["CONCLUIDO", "CANCELADO"].includes(c.status))
    : chamados

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-background sticky top-0 z-10 border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold font-heading">Minhas Ocorrências</h1>
          </div>
          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-xl text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nova
          </button>
        </div>

        {/* Filtro */}
        <div className="flex gap-2">
          {(["ATIVOS", "TODOS"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                filtro === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border"
              )}
            >
              {f === "ATIVOS" ? "Ativos" : "Todos"}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : exibidos.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground">
              {filtro === "ATIVOS" ? "Nenhuma ocorrência ativa" : "Nenhuma ocorrência"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Toque em "Nova" para abrir um chamado</p>
          </div>
        ) : (
          exibidos.map((c) => <ChamadoCard key={c.id} c={c} onCancel={handleCancel} onAtualizado={carregar} />)
        )}
      </div>

      {/* Modal */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-[95vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova Ocorrência</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="titulo" className="text-sm font-medium">Título *</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Vazamento no corredor do 3º andar"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-sm font-medium">Descrição</Label>
              <textarea
                id="desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o problema com mais detalhes..."
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="local" className="text-sm font-medium">Onde?</Label>
              <Input id="local" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex: Garagem, bloco B, 2º subsolo" className="rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Fotos</Label>
              <ArquivosInput valor={fotos} onChange={setFotos} pasta="chamados" max={4} rotulo="Tirar ou anexar foto" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Prioridade</Label>
              <div className="grid grid-cols-2 gap-2">
                {PRIORIDADES.map((p) => {
                  const pc = PRIOR_CONFIG[p]
                  return (
                    <button
                      key={p}
                      onClick={() => setPrioridade(p)}
                      className={cn(
                        "rounded-xl border py-2 px-3 text-sm font-medium transition-all",
                        prioridade === p
                          ? cn("border-primary bg-primary/5 text-primary")
                          : "border-border text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      {pc.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {erro && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {erro}
              </p>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setModalAberto(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleCriar} disabled={saving} className="rounded-xl">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Abrir chamado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

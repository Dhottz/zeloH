"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Megaphone, Plus, Pin, PinOff, Eye, EyeOff,
  Pencil, Trash2, Loader2, Search, Users, Building2, Home, ChevronDown, Archive,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"

// ─── Types ───────────────────────────────────────────────────────────────────

type ComunicadoTipo        = "GERAL" | "URGENTE" | "AVISO" | "EVENTO"
type ComunicadoDestinatario = "TODOS" | "BLOCOS" | "UNIDADES"

interface Comunicado {
  id: string
  titulo: string
  conteudo: string
  tipo: ComunicadoTipo
  publicado: boolean
  fixado: boolean
  arquivado: boolean
  expiraEm: string | null
  createdAt: string
  destinatario: ComunicadoDestinatario
  blocos: string[]
  unidades: string[]
  publicarEm?: string | null
  totalDestinatarios?: number
  _count?: { leituras: number }
  autor: { id: string; nome: string; role: string }
}

function paraDatetimeLocal(iso: string | null | undefined) {
  if (!iso) return ""
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

/** Lista de quem leu / não leu o comunicado. */
function LeiturasDialog({ comunicado, onClose }: { comunicado: Comunicado | null; onClose: () => void }) {
  const [dados, setDados] = useState<{ leram: { id: string; nome: string; bloco: string | null; unidade: string | null; lidoEm: string }[]; naoLeram: { id: string; nome: string; bloco: string | null; unidade: string | null }[] } | null>(null)
  useEffect(() => {
    if (!comunicado) { setDados(null); return }
    fetch(`/api/comunicados/${comunicado.id}/leitura`).then((r) => r.json()).then(setDados)
  }, [comunicado])
  const loc = (m: { bloco: string | null; unidade: string | null }) => [m.bloco && `Bl. ${m.bloco}`, m.unidade && `Apto ${m.unidade}`].filter(Boolean).join(" · ")
  return (
    <Dialog open={!!comunicado} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Confirmação de leitura</DialogTitle></DialogHeader>
        {!dados ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-6" /> : (
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-green-700 mb-1.5">Leram ({dados.leram.length})</p>
              {dados.leram.length === 0 ? <p className="text-muted-foreground">Ninguém ainda.</p> : dados.leram.map((m) => (
                <div key={m.id} className="flex justify-between py-1 border-b border-border last:border-0">
                  <span>{m.nome} <span className="text-xs text-muted-foreground">{loc(m)}</span></span>
                  <span className="text-xs text-muted-foreground">{new Date(m.lidoEm).toLocaleDateString("pt-BR")}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Não leram ({dados.naoLeram.length})</p>
              {dados.naoLeram.map((m) => (
                <div key={m.id} className="py-1 border-b border-border last:border-0">{m.nome} <span className="text-xs text-muted-foreground">{loc(m)}</span></div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

const DESTINATARIO_CONFIG: Record<ComunicadoDestinatario, { label: string; icon: React.ReactNode }> = {
  TODOS:    { label: "Todos os moradores", icon: <Users     className="h-3 w-3" /> },
  BLOCOS:   { label: "Por bloco",          icon: <Building2 className="h-3 w-3" /> },
  UNIDADES: { label: "Por unidade",        icon: <Home      className="h-3 w-3" /> },
}

// ─── Config ──────────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<ComunicadoTipo, { label: string; color: string }> = {
  GERAL:    { label: "Geral",    color: "bg-muted text-muted-foreground border-border" },
  AVISO:    { label: "Aviso",    color: "bg-amber-50 text-amber-700 border-amber-200" },
  URGENTE:  { label: "Urgente",  color: "bg-red-50 text-red-700 border-red-200" },
  EVENTO:   { label: "Evento",   color: "bg-blue-50 text-blue-700 border-blue-200" },
}

const TIPOS: ComunicadoTipo[] = ["GERAL", "AVISO", "URGENTE", "EVENTO"]

const initForm = {
  titulo: "", conteudo: "", tipo: "GERAL" as ComunicadoTipo,
  fixado: false, publicado: false, expiraEm: "", publicarEm: "",
  destinatario: "TODOS" as ComunicadoDestinatario,
  blocos: "", unidades: "",   // strings separadas por vírgula na UI
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d))
}

// ─── Card interno ────────────────────────────────────────────────────────────

function ComunicadoCard({
  c, expandedId, setExpandedId, onEditar, onToggle, onArquivar, onExcluir, readonly, onVerLeituras,
}: {
  c: Comunicado
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  onEditar: (c: Comunicado) => void
  onToggle: (c: Comunicado, campo: "publicado" | "fixado") => void
  onArquivar: (id: string) => void
  onVerLeituras?: (c: Comunicado) => void
  onExcluir: (id: string) => void
  readonly?: boolean
}) {
  const tipoCfg  = TIPO_CONFIG[c.tipo]
  const expanded = expandedId === c.id
  return (
    <Card className={cn("flex flex-col transition-opacity", !c.publicado && "opacity-60")}>
      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {c.fixado && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium bg-primary/10 text-primary border-primary/20">
              <Pin className="h-2.5 w-2.5" /> Fixado
            </span>
          )}
          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", tipoCfg.color)}>
            {tipoCfg.label}
          </span>
          {!c.publicado && (
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
              Rascunho
            </span>
          )}
          {c.destinatario && c.destinatario !== "TODOS" && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium bg-violet-50 text-violet-700 border-violet-200">
              {DESTINATARIO_CONFIG[c.destinatario].icon}
              {c.destinatario === "BLOCOS" ? `Blocos: ${c.blocos.join(", ")}` : `Unidades: ${c.unidades.join(", ")}`}
            </span>
          )}
        </div>

        <button onClick={() => setExpandedId(expanded ? null : c.id)} className="text-left space-y-1.5 w-full">
          <p className="font-semibold text-sm text-foreground leading-snug">{c.titulo}</p>
          <p className={cn("text-xs text-muted-foreground leading-relaxed", !expanded && "line-clamp-2")}>{c.conteudo}</p>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={cn("h-3 w-3 transition-transform duration-150", expanded && "rotate-180")} />
            {expanded ? "Recolher" : "Ler mais"}
          </span>
        </button>

        <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground mt-auto">
          <span>Por {c.autor.nome}</span>
          <span>{formatDate(c.createdAt)}</span>
          {c.expiraEm && <span>Expira {formatDate(c.expiraEm)}</span>}
          {c.publicarEm && new Date(c.publicarEm) > new Date() && (
            <span className="text-violet-700 font-medium">Agendado: {new Date(c.publicarEm).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          )}
          {c.publicado && c.totalDestinatarios !== undefined && (
            <button type="button" onClick={() => onVerLeituras?.(c)} className="text-primary hover:underline">
              Lido por {c._count?.leituras ?? 0} de {c.totalDestinatarios}
            </button>
          )}
        </div>

        {!readonly && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-border">
            <button onClick={() => onEditar(c)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Pencil className="h-3 w-3" /> Editar
            </button>
            <button
              onClick={() => onToggle(c, "publicado")}
              className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors",
                c.publicado ? "text-muted-foreground hover:text-foreground hover:bg-muted" : "text-green-700 bg-green-50 hover:bg-green-100")}
            >
              {c.publicado ? <><EyeOff className="h-3 w-3" /> Despublicar</> : <><Eye className="h-3 w-3" /> Publicar</>}
            </button>
            <button
              onClick={() => onToggle(c, "fixado")}
              className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors",
                c.fixado ? "text-primary bg-primary/10 hover:bg-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
            >
              {c.fixado ? <><PinOff className="h-3 w-3" /> Desafixar</> : <><Pin className="h-3 w-3" /> Fixar</>}
            </button>
            <button
              onClick={() => onArquivar(c.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Archive className="h-3 w-3" /> Arquivar
            </button>
            <button onClick={() => onExcluir(c.id)} className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ComunicadosPage() {
  const { usuario } = useAuth()
  const isZelador   = usuario?.role === "ZELADOR" || usuario?.role === "PORTEIRO"

  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [loading, setLoading]         = useState(true)
  const [busca, setBusca]             = useState("")
  const [filtroTipo, setFiltroTipo]   = useState<ComunicadoTipo | "todos">("todos")
  const [filtroPub, setFiltroPub]     = useState<"todos" | "true" | "false">("todos")
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando]       = useState<Comunicado | null>(null)
  const [form, setForm]               = useState({ ...initForm })
  const [vendoLeituras, setVendoLeituras] = useState<Comunicado | null>(null)
  const [salvando, setSalvando]       = useState(false)
  const [feedback, setFeedback]       = useState<{ type: "ok" | "erro"; text: string } | null>(null)
  const [expandedId, setExpandedId]         = useState<string | null>(null)
  const [arquivadosExpanded, setArquivadosExpanded] = useState(false)

  const showFeedback = (type: "ok" | "erro", text: string) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4000)
  }

  const fetchComunicados = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ busca })
      if (filtroTipo !== "todos") params.set("tipo", filtroTipo)
      if (filtroPub  !== "todos") params.set("publicado", filtroPub)

      const res = await fetch(`/api/comunicados?${params}`)
      if (res.ok) {
        const data = await res.json()
        setComunicados(data.comunicados)
      }
    } finally {
      setLoading(false)
    }
  }, [busca, filtroTipo, filtroPub])

  useEffect(() => {
    const t = setTimeout(fetchComunicados, busca ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchComunicados, busca])

  const abrirNovo = () => {
    setEditando(null)
    setForm({ ...initForm })
    setModalAberto(true)
  }

  const abrirEditar = (c: Comunicado) => {
    setEditando(c)
    setForm({
      titulo:       c.titulo,
      conteudo:     c.conteudo,
      tipo:         c.tipo,
      fixado:       c.fixado,
      publicado:    c.publicado,
      expiraEm:     c.expiraEm ? c.expiraEm.slice(0, 10) : "",
      publicarEm:   paraDatetimeLocal(c.publicarEm),
      destinatario: c.destinatario ?? "TODOS",
      blocos:       (c.blocos ?? []).join(", "),
      unidades:     (c.unidades ?? []).join(", "),
    })
    setModalAberto(true)
  }

  const handleSalvar = async () => {
    setSalvando(true)
    try {
      const body = {
        ...form,
        expiraEm: form.expiraEm || null,
        publicarEm: form.publicarEm ? new Date(form.publicarEm).toISOString() : null,
        blocos:   form.blocos.split(",").map(s => s.trim()).filter(Boolean),
        unidades: form.unidades.split(",").map(s => s.trim()).filter(Boolean),
      }
      const url    = editando ? `/api/comunicados/${editando.id}` : "/api/comunicados"
      const method = editando ? "PATCH" : "POST"

      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = await res.json()

      if (res.ok) {
        showFeedback("ok", editando ? "Comunicado atualizado!" : "Comunicado criado!")
        setModalAberto(false)
        fetchComunicados()
      } else {
        showFeedback("erro", json.message ?? "Erro ao salvar.")
      }
    } catch {
      showFeedback("erro", "Erro de conexão.")
    } finally {
      setSalvando(false)
    }
  }

  const handleToggle = async (c: Comunicado, campo: "publicado" | "fixado") => {
    const res  = await fetch(`/api/comunicados/${c.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ [campo]: !c[campo] }),
    })
    if (res.ok) {
      fetchComunicados()
    } else {
      const json = await res.json()
      showFeedback("erro", json.message ?? "Erro.")
    }
  }

  const handleArquivar = async (id: string) => {
    const res = await fetch(`/api/comunicados/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arquivado: true, publicado: false }),
    })
    if (res.ok) {
      showFeedback("ok", "Comunicado arquivado.")
      fetchComunicados()
    } else {
      showFeedback("erro", "Erro ao arquivar.")
    }
  }

  const handleDesarquivar = async (id: string) => {
    const res = await fetch(`/api/comunicados/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arquivado: false, publicado: false }),
    })
    if (res.ok) {
      showFeedback("ok", "Comunicado restaurado como rascunho.")
      fetchComunicados()
    } else {
      showFeedback("erro", "Erro ao restaurar.")
    }
  }

  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir este comunicado?")) return
    const res = await fetch(`/api/comunicados/${id}`, { method: "DELETE" })
    if (res.ok) {
      showFeedback("ok", "Comunicado excluído.")
      fetchComunicados()
    } else {
      showFeedback("erro", "Erro ao excluir.")
    }
  }

  const ativos     = comunicados.filter((c) => !c.arquivado)
  const arquivados = comunicados.filter((c) => c.arquivado)
  const total      = ativos.length
  const publicados = ativos.filter((c) => c.publicado).length
  const fixados    = ativos.filter((c) => c.fixado).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Comunicados</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Publique avisos, eventos e informações para os moradores
          </p>
        </div>
        {!isZelador && (
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="h-4 w-4 mr-2" /> Novo comunicado
          </Button>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
          feedback.type === "ok"
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total",      value: total,      icon: <Megaphone className="h-4 w-4" /> },
          { label: "Publicados", value: publicados, icon: <Eye       className="h-4 w-4" /> },
          { label: "Fixados",    value: fixados,    icon: <Pin       className="h-4 w-4" /> },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">{s.icon}{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar comunicados..."
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          {(["todos", ...TIPOS] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filtroTipo === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "todos" ? "Todos" : TIPO_CONFIG[t].label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          {([["todos", "Todos"], ["true", "Publicados"], ["false", "Rascunhos"]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFiltroPub(v)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filtroPub === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : comunicados.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 gap-3 text-center">
            <div className="rounded-full bg-muted p-3">
              <Megaphone className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {busca ? "Nenhum comunicado encontrado." : "Nenhum comunicado criado ainda."}
            </p>
            {!busca && !isZelador && (
              <Button size="sm" variant="outline" onClick={abrirNovo}>
                <Plus className="h-4 w-4 mr-2" /> Criar comunicado
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (

        <div className="space-y-6">
          {/* Comunicados ativos */}
          {ativos.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <Megaphone className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhum comunicado ativo.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ativos.map((c) => <ComunicadoCard key={c.id} c={c} expandedId={expandedId} setExpandedId={setExpandedId} onEditar={abrirEditar} onToggle={handleToggle} onArquivar={handleArquivar} onExcluir={handleExcluir} readonly={isZelador} onVerLeituras={setVendoLeituras} />)}
            </div>
          )}

          {/* Arquivados */}
          {arquivados.length > 0 && (
            <div>
              <button
                onClick={() => setArquivadosExpanded(v => !v)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
              >
                <Archive className="h-3.5 w-3.5" />
                <span className="font-medium">Arquivados ({arquivados.length})</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform duration-150", arquivadosExpanded && "rotate-180")} />
              </button>

              {arquivadosExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {arquivados.map((c) => (
                    <Card key={c.id} className="flex flex-col opacity-60">
                      <CardContent className="p-4 flex flex-col gap-3 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
                            <Archive className="h-2.5 w-2.5" /> Arquivado
                          </span>
                          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", TIPO_CONFIG[c.tipo].color)}>
                            {TIPO_CONFIG[c.tipo].label}
                          </span>
                        </div>
                        <p className="font-semibold text-sm text-foreground leading-snug">{c.titulo}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{c.conteudo}</p>
                        <div className="text-[11px] text-muted-foreground mt-auto">
                          {c.expiraEm && <span>Expirou em {formatDate(c.expiraEm)}</span>}
                        </div>
                        {!isZelador && (
                          <div className="flex items-center gap-1.5 pt-2 border-t border-border">
                            <button
                              onClick={() => handleDesarquivar(c.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              <Eye className="h-3 w-3" /> Restaurar
                            </button>
                            <button
                              onClick={() => handleExcluir(c.id)}
                              className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar comunicado" : "Novo comunicado"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tipo */}
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <div className="flex gap-2 flex-wrap">
                {TIPOS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, tipo: t }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.tipo === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {TIPO_CONFIG[t].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Destinatário */}
            <div className="space-y-1.5">
              <Label>Destinatários</Label>
              <div className="flex gap-2 flex-wrap">
                {(["TODOS", "BLOCOS", "UNIDADES"] as ComunicadoDestinatario[]).map((d) => {
                  const cfg = DESTINATARIO_CONFIG[d]
                  return (
                    <button
                      key={d}
                      onClick={() => setForm((f) => ({ ...f, destinatario: d }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        form.destinatario === d
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cfg.icon} {cfg.label}
                    </button>
                  )
                })}
              </div>

              {form.destinatario === "BLOCOS" && (
                <div className="mt-2">
                  <Input
                    placeholder="Ex: A, B, C  (separados por vírgula)"
                    value={form.blocos}
                    onChange={(e) => setForm((f) => ({ ...f, blocos: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Informe os blocos exatamente como cadastrados nos moradores</p>
                </div>
              )}
              {form.destinatario === "UNIDADES" && (
                <div className="mt-2">
                  <Input
                    placeholder="Ex: 101, 102, 201  (separados por vírgula)"
                    value={form.unidades}
                    onChange={(e) => setForm((f) => ({ ...f, unidades: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Informe os números das unidades exatamente como cadastrados</p>
                </div>
              )}
            </div>

            {/* Título */}
            <div className="space-y-1.5">
              <Label htmlFor="c-titulo">Título</Label>
              <Input
                id="c-titulo"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Reunião de condomínio — Maio 2026"
              />
            </div>

            {/* Conteúdo */}
            <div className="space-y-1.5">
              <Label htmlFor="c-conteudo">Conteúdo</Label>
              <textarea
                id="c-conteudo"
                rows={5}
                value={form.conteudo}
                onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))}
                placeholder="Descreva o comunicado..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* Expiração */}
            <div className="space-y-1.5">
              <Label htmlFor="c-expira">
                Data de expiração{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="c-expira"
                type="date"
                value={form.expiraEm}
                onChange={(e) => setForm((f) => ({ ...f, expiraEm: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c-agendar">
                Agendar publicação{" "}
                <span className="text-muted-foreground font-normal">(opcional — os moradores só veem e são avisados a partir desta data)</span>
              </Label>
              <Input
                id="c-agendar"
                type="datetime-local"
                value={form.publicarEm}
                onChange={(e) => setForm((f) => ({ ...f, publicarEm: e.target.value, publicado: e.target.value ? true : f.publicado }))}
              />
            </div>

            {/* Opções */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.publicado}
                  onChange={(e) => setForm((f) => ({ ...f, publicado: e.target.checked }))}
                  className="rounded border-input"
                />
                <span className="text-sm">Publicar agora</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.fixado}
                  onChange={(e) => setForm((f) => ({ ...f, fixado: e.target.checked }))}
                  className="rounded border-input"
                />
                <span className="text-sm">Fixar no topo</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editando ? "Salvar alterações" : "Criar comunicado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    <LeiturasDialog comunicado={vendoLeituras} onClose={() => setVendoLeituras(null)} />
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Package, Bell, Check, Plus, Search, Clock,
  ChevronLeft, ChevronRight, X, Loader2, Building2, ChevronDown, Pencil, Trash2,
} from "lucide-react"
import { Button }    from "@/components/ui/button"
import { Input }     from "@/components/ui/input"
import { Card }      from "@/components/ui/card"
import { Skeleton }  from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label }     from "@/components/ui/label"
import { cn }        from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Entrega {
  id:             string
  destNome:       string
  destinatarioId: string | null
  remetente:      string
  descricao:      string | null
  unidade:        string | null
  retirada:       boolean
  retiradaEm:     string | null
  createdAt:      string
}

interface Stats { aguardando: number; retiradasHoje: number; total: number }
interface Morador { id: string; nome: string; unidade: string | null }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function iniciais(nome: string) {
  return nome.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
}

function labelData(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  if (sameDay(d, hoje))  return "Hoje"
  if (sameDay(d, ontem)) return "Ontem"
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
}

function dataKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function EntregasPage() {
  const [entregas, setEntregas]     = useState<Entrega[]>([])
  const [stats, setStats]           = useState<Stats>({ aguardando: 0, retiradasHoje: 0, total: 0 })
  const [loading, setLoading]       = useState(true)
  const [busca, setBusca]           = useState("")
  const [filtro, setFiltro]         = useState<"todos" | "aguardando" | "retiradas">("todos")
  const [pagina, setPagina]         = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)

  const [modalAberto, setModal]           = useState(false)
  const [editandoId, setEditandoId]       = useState<string | null>(null)
  const [excluindo, setExcluindo]         = useState(false)
  const [confirmarExcluir, setConfirmarExcluir] = useState(false)
  const [moradores, setMoradores]         = useState<Morador[]>([])
  const [form, setForm]                   = useState({ destinatarioId: "", remetente: "", descricao: "", retirada: false })
  const [salvando, setSalvando]           = useState(false)
  const [feedback, setFeedback]     = useState<{ id: string; tipo: "ok" | "erro"; texto: string } | null>(null)
  const [avisando, setAvisando]     = useState<string | null>(null)
  const [retirando, setRetirando]   = useState<string | null>(null)

  const showFeedback = (id: string, tipo: "ok" | "erro", texto: string) => {
    setFeedback({ id, tipo, texto })
    setTimeout(() => setFeedback(null), 3000)
  }

  const fetchEntregas = useCallback(async (pg = pagina) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/entregas?pagina=${pg}`)
      const data = await res.json()
      setEntregas(data.entregas ?? [])
      setStats(data.stats ?? { aguardando: 0, retiradasHoje: 0, total: 0 })
      setTotalPaginas(data.totalPaginas ?? 1)
    } finally {
      setLoading(false)
    }
  }, [pagina])

  useEffect(() => { fetchEntregas(pagina) }, [pagina]) // eslint-disable-line

  useEffect(() => {
    if (modalAberto) {
      fetch("/api/moradores")
        .then((r) => r.json())
        .then((d) => setMoradores(d.moradores ?? []))
    }
  }, [modalAberto])

  async function retirar(entrega: Entrega) {
    setRetirando(entrega.id)
    try {
      const res = await fetch(`/api/entregas/${entrega.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "retirar" }),
      })
      if (res.ok) {
        showFeedback(entrega.id, "ok", "Marcada como retirada")
        fetchEntregas(pagina)
      } else {
        const j = await res.json()
        showFeedback(entrega.id, "erro", j.message ?? "Erro ao marcar retirada")
      }
    } finally {
      setRetirando(null)
    }
  }

  async function avisar(entrega: Entrega) {
    setAvisando(entrega.id)
    try {
      const res = await fetch(`/api/entregas/${entrega.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "avisar" }),
      })
      const j = await res.json()
      showFeedback(entrega.id, res.ok ? "ok" : "erro", j.mensagem ?? j.message ?? "Erro")
    } finally {
      setAvisando(null)
    }
  }

  function abrirEdicao(entrega: Entrega) {
    setEditandoId(entrega.id)
    setConfirmarExcluir(false)
    setForm({
      destinatarioId: entrega.destinatarioId ?? "",
      remetente:      entrega.remetente ?? "",
      descricao:      entrega.descricao ?? "",
      retirada:       entrega.retirada,
    })
    setModal(true)
  }

  function fecharModal() {
    setModal(false)
    setEditandoId(null)
    setConfirmarExcluir(false)
    setForm({ destinatarioId: "", remetente: "", descricao: "", retirada: false })
  }

  async function excluir() {
    if (!editandoId) return
    setExcluindo(true)
    try {
      const res = await fetch(`/api/entregas/${editandoId}`, { method: "DELETE" })
      if (res.ok) { fecharModal(); fetchEntregas(pagina) }
    } finally {
      setExcluindo(false)
    }
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      if (editandoId) {
        const res = await fetch(`/api/entregas/${editandoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            acao:           "editar",
            destinatarioId: form.destinatarioId || undefined,
            remetente:      form.remetente,
            descricao:      form.descricao,
            retirada:       form.retirada,
          }),
        })
        if (res.ok) { fecharModal(); fetchEntregas(pagina) }
        else { const j = await res.json().catch(() => ({})); showFeedback(editandoId, "erro", j.message ?? "Erro ao salvar") }
      } else {
        const res = await fetch("/api/entregas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (res.ok) { fecharModal(); fetchEntregas(1); setPagina(1) }
      }
    } finally {
      setSalvando(false)
    }
  }

  const [datasExpandidas, setDatasExpandidas] = useState<Set<string>>(
    () => new Set([dataKey(new Date().toISOString())])
  )

  const toggleData = (key: string) =>
    setDatasExpandidas(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const filtradas = entregas.filter((e) => {
    if (filtro === "aguardando" && e.retirada)  return false
    if (filtro === "retiradas"  && !e.retirada) return false
    if (busca) {
      const q = busca.toLowerCase()
      return (
        e.destNome.toLowerCase().includes(q) ||
        e.remetente.toLowerCase().includes(q) ||
        (e.unidade ?? "").toLowerCase().includes(q)
      )
    }
    return true
  })

  const entregasPorData = useMemo(() => {
    const grupos = new Map<string, { label: string; items: Entrega[] }>()
    for (const e of filtradas) {
      const key   = dataKey(e.createdAt)
      const label = labelData(e.createdAt)
      if (!grupos.has(key)) grupos.set(key, { label, items: [] })
      grupos.get(key)!.items.push(e)
    }
    return new Map([...grupos.entries()].sort(([a], [b]) => b.localeCompare(a)))
  }, [filtradas])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Entregas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditandoId(null); setModal(true) }}>
          <Plus className="w-4 h-4" /> Registrar entrega
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Aguardando retirada", value: stats.aguardando,    icon: Clock,   color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Retiradas hoje",      value: stats.retiradasHoje, icon: Check,   color: "text-green-600",  bg: "bg-green-50" },
          { label: "Total no mês",        value: stats.total,         icon: Package, color: "text-primary",    bg: "bg-primary/10" },
        ].map((s) => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", s.bg)}>
              <s.icon className={cn("w-5 h-5", s.color)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              {loading
                ? <Skeleton className="h-7 w-10 mt-1" />
                : <p className="text-2xl font-heading font-bold">{s.value}</p>}
            </div>
          </Card>
        ))}
      </div>

      {/* Filtros + busca */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar destinatário, unidade ou remetente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center border border-border rounded-lg overflow-hidden text-sm">
          {([
            { v: "todos",     l: "Todos" },
            { v: "aguardando",l: "Aguardando" },
            { v: "retiradas", l: "Retiradas" },
          ] as const).map(({ v, l }) => (
            <button key={v} onClick={() => setFiltro(v)}
              className={cn(
                "px-4 py-1.5 transition-colors border-r border-border last:border-0",
                filtro === v ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/60"
              )}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-full rounded-lg" />
              </Card>
            ))}
          </div>
        </div>
      ) : filtradas.length === 0 ? (
        <Card className="py-14 text-center">
          <Package className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma entrega encontrada</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(entregasPorData.entries()).map(([key, { label, items }]) => {
            const colapsado = !datasExpandidas.has(key)
            return (
              <div key={key}>
                {/* Cabeçalho da data (dropdown) */}
                <button
                  onClick={() => toggleData(key)}
                  className="flex items-center gap-3 mb-3 w-full group"
                >
                  <ChevronDown className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
                    colapsado && "-rotate-90"
                  )} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground capitalize">
                    {label}
                  </span>
                  {items.filter(e => !e.retirada).length > 0 && (
                    <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                      {items.filter(e => !e.retirada).length} pendente{items.filter(e => !e.retirada).length !== 1 ? "s" : ""}
                    </span>
                  )}
                  <div className="flex-1 h-px bg-border" />
                </button>

                {!colapsado && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((entrega) => {
            const fb = feedback?.id === entrega.id ? feedback : null

            return (
              <Card
                key={entrega.id}
                className={cn(
                  "p-4 flex flex-col gap-3 transition-opacity",
                  entrega.retirada && "opacity-60"
                )}
              >
                {/* Destinatário */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                    entrega.retirada ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"
                  )}>
                    {entrega.retirada ? <Check className="w-4 h-4" /> : iniciais(entrega.destNome)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{entrega.destNome}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {entrega.unidade && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />{entrega.unidade}
                        </span>
                      )}
                      {entrega.descricao && (
                        <span className="truncate max-w-[140px]" title={entrega.descricao}>
                          {entrega.descricao}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Remetente + Chegada */}
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {entrega.remetente && (
                    <p className="truncate">De: {entrega.remetente}</p>
                  )}
                  <p>Chegou {fmtData(entrega.createdAt)} às {fmtHora(entrega.createdAt)}</p>
                  {entrega.retirada && entrega.retiradaEm && (
                    <p className="text-green-600">
                      Retirada {fmtData(entrega.retiradaEm)} às {fmtHora(entrega.retiradaEm)}
                    </p>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 mt-auto">
                  {fb ? (
                    <span className={cn(
                      "text-xs font-medium px-3 py-1.5 rounded-lg border w-full text-center",
                      fb.tipo === "ok"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    )}>
                      {fb.texto}
                    </span>
                  ) : !entrega.retirada ? (
                    <>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs flex-1"
                        onClick={() => avisar(entrega)}
                        disabled={avisando === entrega.id}>
                        {avisando === entrega.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Bell className="w-3 h-3" />}
                        Avisar
                      </Button>
                      <Button size="sm" className="h-8 gap-1.5 text-xs flex-1"
                        onClick={() => retirar(entrega)}
                        disabled={retirando === entrega.id}>
                        {retirando === entrega.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Check className="w-3 h-3" />}
                        Retirar
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Concluída</span>
                  )}
                  <button
                    onClick={() => abrirEdicao(entrega)}
                    className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            )
          })}
                </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {stats.total} registros · Página {pagina} de {totalPaginas}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="icon"
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              disabled={pagina === 1 || loading}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon"
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              disabled={pagina === totalPaginas || loading}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal registrar / editar entrega */}
      <Dialog open={modalAberto} onOpenChange={open => { if (!open) fecharModal() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">
              {editandoId ? "Editar entrega" : "Registrar entrega"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={registrar} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Destinatário{editandoId && <span className="text-muted-foreground font-normal"> (deixe em branco para manter)</span>}
              </Label>
              <select
                value={form.destinatarioId}
                onChange={(e) => setForm((f) => ({ ...f, destinatarioId: e.target.value }))}
                required={!editandoId}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">{editandoId ? "Sem alteração" : "Selecionar morador..."}</option>
                {moradores.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}{m.unidade ? ` · ${m.unidade}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Remetente <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                placeholder="Amazon, Correios, iFood..."
                value={form.remetente}
                onChange={(e) => setForm((f) => ({ ...f, remetente: e.target.value }))}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Observação <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                placeholder="Caixa grande, frágil, requer assinatura..."
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                className="h-9"
              />
            </div>

            {editandoId && (
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, retirada: !f.retirada }))}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                  form.retirada
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-muted/50 text-muted-foreground border-border"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                  form.retirada ? "border-green-600 bg-green-600" : "border-muted-foreground"
                )}>
                  {form.retirada && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                {form.retirada ? "Marcada como retirada" : "Marcar como não retirada"}
              </button>
            )}

            <div className="flex items-center gap-2 pt-1">
              {editandoId && (
                confirmarExcluir ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Confirmar exclusão?</span>
                    <button
                      type="button"
                      onClick={excluir}
                      disabled={excluindo}
                      className="text-xs font-medium text-destructive hover:underline disabled:opacity-50"
                    >
                      {excluindo ? "Excluindo..." : "Sim, excluir"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmarExcluir(false)}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmarExcluir(true)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                )
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button type="button" variant="outline" size="sm" onClick={fecharModal}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={salvando || (!editandoId && !form.destinatarioId)}>
                  {salvando
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />{editandoId ? "Salvando..." : "Registrando..."}</>
                    : editandoId ? "Salvar" : "Registrar"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

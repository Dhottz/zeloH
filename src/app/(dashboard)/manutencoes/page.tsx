"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import {
  Wrench, RefreshCw, Link2, Link2Off, CheckCircle2, Clock,
  AlertTriangle, ChevronLeft, ChevronRight, Loader2, Calendar,
  User, Building2, DollarSign, Eye, EyeOff, Search, Plus,
  MapPin, FileText, X, ChevronDown, ChevronRight as ChevronRightIcon,
  FileDown, Pencil,
} from "lucide-react"
import { Button }   from "@/components/ui/button"
import { Badge }    from "@/components/ui/badge"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Manutencao {
  id: string
  visttoOsId: string | null
  visttoOsCod: string | null
  titulo: string
  descricao: string | null
  status: string
  prioridade: string
  prestadorNome: string | null
  prestadorCnpj: string | null
  empresaNome: string | null
  observacoes: string | null
  local: string | null
  valor: number | null
  agendadoEm: string | null
  concluidoEm: string | null
  visivelParaMoradores: boolean
  origem: string
}

interface VisttoStatus  { vinculado: boolean; visttoClientId: string | null; cnpj: string | null }
interface SyncStatus    { total: number; ultimoSyncEm: string | null }
interface PaginatedResponse {
  registros: Manutencao[]; total: number; pagina: number; limite: number; totalPaginas: number
}

const initForm = {
  titulo: "", descricao: "", status: "OPEN", prioridade: "MEDIUM",
  empresaNome: "", prestadorNome: "", prestadorCnpj: "",
  valor: "", agendadoEm: "", local: "", observacoes: "",
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ReactNode; color: string }> = {
  COMPLETED:   { label: "Concluída",    variant: "default",     icon: <CheckCircle2 className="h-3 w-3" />, color: "bg-green-50 text-green-700 border-green-200" },
  IN_PROGRESS: { label: "Em andamento", variant: "secondary",   icon: <Clock className="h-3 w-3" />,       color: "bg-blue-50 text-blue-700 border-blue-200" },
  PENDING:     { label: "Agendada",     variant: "outline",     icon: <Clock className="h-3 w-3" />,       color: "bg-amber-50 text-amber-700 border-amber-200" },
  OPEN:        { label: "Aberta",       variant: "outline",     icon: <Wrench className="h-3 w-3" />,      color: "bg-orange-50 text-orange-700 border-orange-200" },
  CANCELLED:   { label: "Cancelada",    variant: "destructive", icon: <AlertTriangle className="h-3 w-3" />, color: "bg-red-50 text-red-700 border-red-200" },
}

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string }> = {
  URGENT: { label: "Urgente", color: "text-red-700 bg-red-100 border-red-300" },
  HIGH:   { label: "Alta",    color: "text-red-600 bg-red-50 border-red-200" },
  MEDIUM: { label: "Média",   color: "text-amber-600 bg-amber-50 border-amber-200" },
  LOW:    { label: "Baixa",   color: "text-green-700 bg-green-50 border-green-200" },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null) =>
  d ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d)) : "—"

const fmtCurrency = (v: number | null) =>
  v == null ? null : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const fmtRelativo = (d: string | null) => {
  if (!d) return "Nunca"
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (mins < 1)   return "Agora mesmo"
  if (mins < 60)  return `Há ${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `Há ${hrs}h`
  return `Há ${Math.floor(hrs / 24)} dias`
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ManutencoesPage() {
  const [registros, setRegistros]         = useState<Manutencao[]>([])
  const [loading, setLoading]             = useState(true)
  const [syncing, setSyncing]             = useState(false)
  const [vinculando, setVinculando]       = useState(false)
  const [visttoStatus, setVisttoStatus]   = useState<VisttoStatus | null>(null)
  const [syncStatus, setSyncStatus]       = useState<SyncStatus | null>(null)
  const [pagina, setPagina]               = useState(1)
  const [totalPaginas, setTotalPaginas]   = useState(1)
  const [total, setTotal]                 = useState(0)
  const [feedback, setFeedback]           = useState<{ type: "ok" | "erro"; text: string } | null>(null)

  // Filtros
  const [busca, setBusca]                 = useState("")
  const [filtroStatus, setFiltroStatus]   = useState("todos")
  const [filtroPrioridade, setFiltroPrioridade] = useState("todas")
  const [filtroPrestador, setFiltroPrestador] = useState("")
  const [filtroVisivel, setFiltroVisivel] = useState("todas")

  // Meses expandidos (apenas o mês atual aberto por padrão)
  const [mesesExpandidos, setMesesExpandidos] = useState<Set<string>>(() => {
    const hoje = new Date()
    const key = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
    return new Set([key])
  })

  const toggleMes = (mesKey: string) =>
    setMesesExpandidos(prev => {
      const next = new Set(prev)
      next.has(mesKey) ? next.delete(mesKey) : next.add(mesKey)
      return next
    })

  // Modal registro / edição
  const [modalAberto, setModalAberto]     = useState(false)
  const [editandoId, setEditandoId]       = useState<string | null>(null)
  const [form, setForm]                   = useState({ ...initForm })
  const [salvando, setSalvando]           = useState(false)

  const showFeedback = (type: "ok" | "erro", text: string) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4000)
  }

  const fetchStatuses = useCallback(async () => {
    const [vRes, sRes] = await Promise.all([
      fetch("/api/vistto/vincular"),
      fetch("/api/vistto/sync"),
    ])
    if (vRes.ok) setVisttoStatus(await vRes.json())
    if (sRes.ok) setSyncStatus(await sRes.json())
  }, [])

  const fetchManutencoes = useCallback(async (pg = pagina) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ pagina: String(pg), limite: "20" })
      if (filtroStatus      !== "todos")  params.set("status",     filtroStatus)
      if (filtroPrioridade  !== "todas")  params.set("prioridade", filtroPrioridade)
      if (filtroPrestador.trim())         params.set("prestador",  filtroPrestador.trim())
      if (filtroVisivel     !== "todas")  params.set("visivel",    filtroVisivel)
      if (busca.trim())                   params.set("busca",      busca.trim())

      const res = await fetch(`/api/manutencoes?${params}`)
      if (res.ok) {
        const data: PaginatedResponse = await res.json()
        setRegistros(data.registros)
        setTotal(data.total)
        setTotalPaginas(data.totalPaginas)
        setPagina(data.pagina)
      }
    } finally {
      setLoading(false)
    }
  }, [pagina, filtroStatus, filtroPrioridade, filtroPrestador, filtroVisivel, busca])

  useEffect(() => { fetchStatuses() }, [fetchStatuses])

  useEffect(() => {
    const t = setTimeout(() => { fetchManutencoes(1); setPagina(1) }, busca ? 400 : 0)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroStatus, filtroPrioridade, filtroPrestador, filtroVisivel, busca])

  useEffect(() => { fetchManutencoes(pagina) }, [pagina]) // eslint-disable-line

  // Ações VISTTO
  const handleVincular = async () => {
    setVinculando(true)
    try {
      const res = await fetch("/api/vistto/vincular", { method: "POST" })
      const json = await res.json()
      if (res.ok) { showFeedback("ok", json.message); await fetchStatuses() }
      else          showFeedback("erro", json.message ?? "Erro ao vincular.")
    } finally { setVinculando(false) }
  }

  const handleDesvincular = async () => {
    setVinculando(true)
    try {
      const res = await fetch("/api/vistto/vincular", { method: "DELETE" })
      const json = await res.json()
      if (res.ok) { showFeedback("ok", json.message); setRegistros([]); setTotal(0); await fetchStatuses() }
      else          showFeedback("erro", json.message ?? "Erro ao desvincular.")
    } finally { setVinculando(false) }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/vistto/sync", { method: "POST" })
      const json = await res.json()
      if (res.ok) { showFeedback("ok", `${json.sincronizados} OS sincronizadas.`); await Promise.all([fetchStatuses(), fetchManutencoes(1)]); setPagina(1) }
      else          showFeedback("erro", json.message ?? "Erro na sincronização.")
    } finally { setSyncing(false) }
  }

  // Toggle visível
  const handleToggleVisivel = async (os: Manutencao) => {
    const novo = !os.visivelParaMoradores
    setRegistros(prev => prev.map(r => r.id === os.id ? { ...r, visivelParaMoradores: novo } : r))
    try {
      const res = await fetch(`/api/manutencoes/${os.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visivelParaMoradores: novo }),
      })
      if (!res.ok) {
        setRegistros(prev => prev.map(r => r.id === os.id ? { ...r, visivelParaMoradores: !novo } : r))
        showFeedback("erro", "Erro ao atualizar visibilidade.")
      }
    } catch {
      setRegistros(prev => prev.map(r => r.id === os.id ? { ...r, visivelParaMoradores: !novo } : r))
    }
  }

  // Abrir modal de edição
  const handleEditar = (os: Manutencao) => {
    setEditandoId(os.id)
    setForm({
      titulo:        os.titulo,
      descricao:     os.descricao     ?? "",
      status:        os.status,
      prioridade:    os.prioridade    ?? "MEDIUM",
      empresaNome:   os.empresaNome   ?? "",
      prestadorNome: os.prestadorNome ?? "",
      prestadorCnpj: os.prestadorCnpj ?? "",
      valor:         os.valor != null ? String(os.valor) : "",
      agendadoEm:    os.agendadoEm    ? os.agendadoEm.slice(0, 10) : "",
      local:         os.local         ?? "",
      observacoes:   os.observacoes   ?? "",
    })
    setModalAberto(true)
  }

  // Fechar modal e limpar estado de edição
  const handleFecharModal = () => {
    setModalAberto(false)
    setEditandoId(null)
    setForm({ ...initForm })
  }

  // Salvar (criar ou editar)
  const handleSalvar = async () => {
    setSalvando(true)
    try {
      const body = {
        ...form,
        valor:      form.valor ? parseFloat(form.valor.replace(",", ".")) : null,
        agendadoEm: form.agendadoEm || null,
      }

      const res = editandoId
        ? await fetch(`/api/manutencoes/${editandoId}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/manutencoes", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })

      const json = await res.json()
      if (res.ok) {
        showFeedback("ok", editandoId ? "Manutenção atualizada!" : "Manutenção registrada com sucesso!")
        handleFecharModal()
        fetchManutencoes(pagina)
      } else {
        showFeedback("erro", json.message ?? "Erro ao salvar.")
      }
    } catch { showFeedback("erro", "Erro de conexão.") }
    finally  { setSalvando(false) }
  }

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtrosAtivos = [filtroStatus, filtroPrioridade, filtroVisivel].filter(v => !["todos", "todas"].includes(v)).length + (busca ? 1 : 0) + (filtroPrestador.trim() ? 1 : 0)

  // Agrupa registros por mês (baseado em agendadoEm ou createdAt)
  const registrosPorMes = useMemo(() => {
    const grupos = new Map<string, { label: string; items: Manutencao[] }>()
    for (const r of registros) {
      const data = r.agendadoEm ? new Date(r.agendadoEm) : null
      const key  = data
        ? `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
        : "sem-data"
      const label = data
        ? data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
        : "Sem data agendada"
      if (!grupos.has(key)) grupos.set(key, { label, items: [] })
      grupos.get(key)!.items.push(r)
    }
    return new Map([...grupos.entries()].sort(([a], [b]) => {
      if (a === "sem-data") return -1
      if (b === "sem-data") return  1
      return b.localeCompare(a)
    }))
  }, [registros])

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Manutenções</h1>
          <p className="text-sm text-muted-foreground mt-1">OS do VISTTO e registros manuais</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => setModalAberto(true)}>
            <Plus className="h-4 w-4 mr-2" /> Registrar manutenção
          </Button>
          {visttoStatus?.vinculado ? (
            <>
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Sincronizar VISTTO
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDesvincular} disabled={vinculando} className="text-muted-foreground hover:text-destructive">
                <Link2Off className="h-4 w-4 mr-2" /> Desvincular
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={handleVincular} disabled={vinculando}>
              {vinculando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
              Vincular VISTTO
            </Button>
          )}
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={cn("rounded-lg px-4 py-3 text-sm font-medium border", feedback.type === "ok" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200")}>
          {feedback.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total",        value: total,                                          icon: <Wrench className="h-4 w-4" /> },
          { label: "Abertas",      value: registros.filter(r => ["OPEN","IN_PROGRESS","PENDING"].includes(r.status)).length, icon: <Clock className="h-4 w-4" /> },
          { label: "Vinculação",   value: visttoStatus?.vinculado ? "Ativo" : "Inativo",  icon: <RefreshCw className="h-4 w-4" /> },
          { label: "Último sync",  value: fmtRelativo(syncStatus?.ultimoSyncEm ?? null),  icon: <Calendar className="h-4 w-4" /> },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">{s.icon}{s.label}</p>
              <p className="text-lg font-bold mt-1 truncate">{loading && typeof s.value === "number" ? "–" : s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, empresa, local..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filtros avançados */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={filtroStatus} onValueChange={v => v && setFiltroStatus(v)}>
              <SelectTrigger className="h-9 text-sm">
                <span>{{ todos: "Todos", OPEN: "Aberta", IN_PROGRESS: "Em andamento", PENDING: "Agendada", COMPLETED: "Concluída", CANCELLED: "Cancelada" }[filtroStatus] ?? filtroStatus}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="OPEN">Aberta</SelectItem>
                <SelectItem value="IN_PROGRESS">Em andamento</SelectItem>
                <SelectItem value="PENDING">Agendada</SelectItem>
                <SelectItem value="COMPLETED">Concluída</SelectItem>
                <SelectItem value="CANCELLED">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Prioridade</Label>
            <Select value={filtroPrioridade} onValueChange={v => v && setFiltroPrioridade(v)}>
              <SelectTrigger className="h-9 text-sm">
                <span>{{ todas: "Todas", URGENT: "Urgente", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" }[filtroPrioridade] ?? filtroPrioridade}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="URGENT">Urgente</SelectItem>
                <SelectItem value="HIGH">Alta</SelectItem>
                <SelectItem value="MEDIUM">Média</SelectItem>
                <SelectItem value="LOW">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Prestador</Label>
            <Input
              placeholder="Nome do prestador…"
              value={filtroPrestador}
              onChange={e => setFiltroPrestador(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Visível moradores</Label>
            <Select value={filtroVisivel} onValueChange={v => v && setFiltroVisivel(v)}>
              <SelectTrigger className="h-9 text-sm">
                <span>{{ todas: "Todas", true: "Visíveis", false: "Ocultas" }[filtroVisivel] ?? filtroVisivel}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="true">Visíveis</SelectItem>
                <SelectItem value="false">Ocultas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtrosAtivos > 0 && (
          <button
            onClick={() => { setFiltroStatus("todos"); setFiltroPrioridade("todas"); setFiltroPrestador(""); setFiltroVisivel("todas"); setBusca("") }}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Limpar todos os filtros
          </button>
        )}
      </div>

      {/* ── Lista ─────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : registros.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 gap-3 text-center">
            <div className="rounded-full bg-muted p-3"><Wrench className="h-6 w-6 text-muted-foreground" /></div>
            <p className="text-sm text-muted-foreground">
              {filtrosAtivos > 0 || busca ? "Nenhuma manutenção encontrada com os filtros selecionados." : "Nenhuma manutenção registrada ainda."}
            </p>
            <Button size="sm" variant="outline" onClick={() => setModalAberto(true)}>
              <Plus className="h-4 w-4 mr-2" /> Registrar manutenção
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(registrosPorMes.entries()).map(([mesKey, { label: mesLabel, items }]) => {
            const colapsado = !mesesExpandidos.has(mesKey)
            return (
            <div key={mesKey}>
              {/* Cabeçalho do mês (dropdown) */}
              <button
                onClick={() => toggleMes(mesKey)}
                className="flex items-center gap-3 mb-2 w-full group"
              >
                <ChevronDown className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
                  colapsado && "-rotate-90"
                )} />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground capitalize">
                  {mesLabel}
                </span>
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {items.length}
                </span>
                <div className="flex-1 h-px bg-border" />
              </button>

              {!colapsado && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((os) => {
                    const statusCfg  = STATUS_CONFIG[os.status] ?? { label: os.status, color: "bg-muted text-muted-foreground border-border", icon: null }
                    const prioCfg    = PRIORIDADE_CONFIG[os.prioridade] ?? { label: os.prioridade ?? "—", color: "bg-muted text-muted-foreground border-border" }
                    const isExpanded = expandedId === os.id

                    return (
                      <Card key={os.id} className="p-4 flex flex-col gap-3">
                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {os.visttoOsCod && (
                            <span className="text-[10px] font-mono text-muted-foreground">#{os.visttoOsCod}</span>
                          )}
                          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", statusCfg.color)}>
                            {statusCfg.icon}{statusCfg.label}
                          </span>
                          {os.prioridade && (
                            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", prioCfg.color)}>
                              {prioCfg.label}
                            </span>
                          )}
                          <span className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            os.origem === "MANUAL"
                              ? "bg-violet-50 text-violet-700 border-violet-200"
                              : "bg-sky-50 text-sky-700 border-sky-200"
                          )}>
                            {os.origem === "MANUAL" ? "Manual" : "VISTTO"}
                          </span>
                        </div>

                        {/* Título */}
                        <p className="text-sm font-medium text-foreground leading-snug">{os.titulo}</p>

                        {/* Infos rápidas */}
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {os.empresaNome && (
                            <p className="flex items-center gap-1 truncate">
                              <Building2 className="h-3 w-3 shrink-0" />{os.empresaNome}
                            </p>
                          )}
                          {os.prestadorNome && (
                            <p className="flex items-center gap-1 truncate">
                              <User className="h-3 w-3 shrink-0" />{os.prestadorNome}
                            </p>
                          )}
                          {os.agendadoEm && (
                            <p className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 shrink-0" />{fmtDate(os.agendadoEm)}
                            </p>
                          )}
                          {os.valor != null && (
                            <p className="flex items-center gap-1 font-medium text-foreground">
                              <DollarSign className="h-3 w-3 shrink-0 text-muted-foreground" />{fmtCurrency(os.valor)}
                            </p>
                          )}
                        </div>

                        {/* Detalhes expansíveis */}
                        {isExpanded && (
                          <div className="border-t border-border pt-3 space-y-3">
                            <div className="grid grid-cols-1 gap-y-2.5 text-xs">
                              {os.local && (
                                <div>
                                  <p className="text-muted-foreground mb-0.5">Local</p>
                                  <p className="flex items-center gap-1.5 font-medium text-sm">
                                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />{os.local}
                                  </p>
                                </div>
                              )}
                              {os.concluidoEm && (
                                <div>
                                  <p className="text-muted-foreground mb-0.5">Concluída em</p>
                                  <p className="flex items-center gap-1.5 font-medium text-green-700 text-sm">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />{fmtDate(os.concluidoEm)}
                                  </p>
                                </div>
                              )}
                              {os.prestadorCnpj && (
                                <div>
                                  <p className="text-muted-foreground mb-0.5">CNPJ Prestador</p>
                                  <p className="flex items-center gap-1.5 font-medium font-mono">
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />{os.prestadorCnpj}
                                  </p>
                                </div>
                              )}
                            </div>
                            {os.descricao && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                                <p className="text-xs text-foreground whitespace-pre-wrap">{os.descricao}</p>
                              </div>
                            )}
                            {os.observacoes && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Observações</p>
                                <p className="text-xs text-foreground bg-muted/50 rounded-lg px-3 py-2 whitespace-pre-wrap">{os.observacoes}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Ações */}
                        <div className="flex flex-wrap items-center gap-2 mt-auto pt-1 border-t border-border">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : os.id)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-150", isExpanded && "rotate-180")} />
                            {isExpanded ? "Menos" : "Detalhes"}
                          </button>
                          <div className="flex items-center gap-1.5 ml-auto">
                            <button
                              onClick={() => handleEditar(os)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted transition-colors"
                            >
                              <Pencil className="h-3 w-3" /> Editar
                            </button>
                            <button
                              onClick={() => handleToggleVisivel(os)}
                              title={os.visivelParaMoradores ? "Ocultar dos moradores" : "Compartilhar com moradores"}
                              className={cn(
                                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                                os.visivelParaMoradores
                                  ? "bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                  : "bg-muted text-muted-foreground border-border hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                              )}
                            >
                              {os.visivelParaMoradores
                                ? <><Eye className="h-3 w-3" /> Visível</>
                                : <><EyeOff className="h-3 w-3" /> Oculto</>}
                            </button>
                            {os.visttoOsId && (
                              <a
                                href={`/api/vistto/pdf/${os.visttoOsId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted transition-colors"
                              >
                                <FileDown className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )})}
        </div>
      )}

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">{total} registros · Página {pagina} de {totalPaginas}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1 || loading}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas || loading}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Modal registro / edição ─────────────────────────────────────────── */}
      <Dialog open={modalAberto} onOpenChange={handleFecharModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar manutenção" : "Registrar manutenção"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Título */}
            <div className="space-y-1.5">
              <Label htmlFor="m-titulo">Título *</Label>
              <Input id="m-titulo" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Troca de bomba da piscina" />
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="m-desc">Descrição</Label>
              <textarea
                id="m-desc"
                rows={3}
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Descreva o problema ou serviço..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {/* Status + Prioridade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => v && setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Aberta</SelectItem>
                    <SelectItem value="PENDING">Agendada</SelectItem>
                    <SelectItem value="IN_PROGRESS">Em andamento</SelectItem>
                    <SelectItem value="COMPLETED">Concluída</SelectItem>
                    <SelectItem value="CANCELLED">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => v && setForm(f => ({ ...f, prioridade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="MEDIUM">Média</SelectItem>
                    <SelectItem value="LOW">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Empresa */}
            <div className="space-y-1.5">
              <Label htmlFor="m-empresa">Empresa prestadora</Label>
              <Input id="m-empresa" value={form.empresaNome} onChange={e => setForm(f => ({ ...f, empresaNome: e.target.value }))} placeholder="Nome da empresa" />
            </div>

            {/* Responsável + CNPJ */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-resp">Responsável / Técnico</Label>
                <Input id="m-resp" value={form.prestadorNome} onChange={e => setForm(f => ({ ...f, prestadorNome: e.target.value }))} placeholder="Nome do técnico" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-cnpj">CNPJ da empresa</Label>
                <Input id="m-cnpj" value={form.prestadorCnpj} onChange={e => setForm(f => ({ ...f, prestadorCnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
              </div>
            </div>

            {/* Local + Valor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-local">Local</Label>
                <Input id="m-local" value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} placeholder="Ex: Área de lazer" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-valor">Valor estimado (R$)</Label>
                <Input id="m-valor" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
              </div>
            </div>

            {/* Data agendamento */}
            <div className="space-y-1.5">
              <Label htmlFor="m-data">Data de agendamento</Label>
              <Input id="m-data" type="date" value={form.agendadoEm} onChange={e => setForm(f => ({ ...f, agendadoEm: e.target.value }))} />
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="m-obs">Observações</Label>
              <textarea
                id="m-obs"
                rows={3}
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Informações adicionais, garantias, contatos..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleFecharModal}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando || !form.titulo.trim()}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editandoId ? "Salvar alterações" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

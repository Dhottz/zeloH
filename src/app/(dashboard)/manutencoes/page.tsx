"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import {
  Wrench, RefreshCw, Link2, Link2Off, Clock, AlertTriangle, ChevronLeft, ChevronRight, Loader2,
  Calendar, User, Search, Plus, X, ChevronDown, Cog, Receipt, Camera, ListChecks, Eye, EyeOff,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/textarea"
import { PageHeader, StatCard, Pilulas, EstadoVazio } from "@/components/shared/page-header"
import { ModuloGate } from "@/components/shared/modulo-gate"
import { ManutencaoForm } from "@/components/manutencoes/manutencao-form"
import { ManutencaoDetalhe } from "@/components/manutencoes/manutencao-detalhe"
import { PlanosPreventivos } from "@/components/manutencoes/planos-preventivos"
import {
  STATUS_CONFIG, PRIORIDADE_CONFIG, TIPO_CONFIG, estaAtrasada, type Manutencao,
} from "@/components/manutencoes/tipos"
import { useAuth } from "@/hooks/use-auth"
import { podeGerenciar, podeOperar } from "@/lib/permissions"
import { cn, formatDate, formatMoeda } from "@/lib/utils"

interface VisttoStatus { vinculado: boolean; visttoClientId: string | null; cnpj: string | null }
interface SyncStatus   { total: number; ultimoSyncEm: string | null }

type Aba = "ordens" | "planos"
type FiltroEspecial = "" | "atrasadas" | "orcamento"

const fmtRelativo = (d: string | null) => {
  if (!d) return "Nunca"
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (mins < 1) return "Agora mesmo"
  if (mins < 60) return `Há ${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Há ${hrs}h`
  return `Há ${Math.floor(hrs / 24)} dias`
}

function Conteudo() {
  const { usuario } = useAuth()
  const role = usuario?.role
  const gestor = podeGerenciar(role)
  const ehPrestador = role === "PRESTADOR"

  const [aba, setAba] = useState<Aba>("ordens")
  const [registros, setRegistros] = useState<Manutencao[]>([])
  const [resumo, setResumo] = useState({ abertas: 0, atrasadas: 0, orcamentosPendentes: 0 })
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [total, setTotal] = useState(0)

  // VISTTO
  const [syncing, setSyncing] = useState(false)
  const [vinculando, setVinculando] = useState(false)
  const [visttoStatus, setVisttoStatus] = useState<VisttoStatus | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)

  // Filtros
  const [busca, setBusca] = useState("")
  const [filtroStatus, setFiltroStatus] = useState("")
  const [filtroTipo, setFiltroTipo] = useState("")
  const [filtroEspecial, setFiltroEspecial] = useState<FiltroEspecial>("")
  const [filtroVisivel, setFiltroVisivel] = useState("")

  // Modais
  const [form, setForm] = useState<{ aberto: boolean; editando: Manutencao | null }>({ aberto: false, editando: null })
  const [detalhe, setDetalhe] = useState<Manutencao | null>(null)

  const [mesesFechados, setMesesFechados] = useState<Set<string>>(new Set())

  // Atalhos vindos do dashboard (?filtro=atrasadas | orcamento)
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filtro")
    if (f === "atrasadas" || f === "orcamento") setFiltroEspecial(f)
  }, [])

  const fetchStatuses = useCallback(async () => {
    if (!gestor) return
    const [vRes, sRes] = await Promise.all([fetch("/api/vistto/vincular"), fetch("/api/vistto/sync")])
    if (vRes.ok) setVisttoStatus(await vRes.json())
    if (sRes.ok) setSyncStatus(await sRes.json())
  }, [gestor])

  const fetchManutencoes = useCallback(async (pg: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ pagina: String(pg), limite: "30" })
      if (filtroStatus) params.set("status", filtroStatus)
      if (filtroTipo) params.set("tipo", filtroTipo)
      if (filtroEspecial) params.set("filtro", filtroEspecial)
      if (filtroVisivel) params.set("visivel", filtroVisivel)
      if (busca.trim()) params.set("busca", busca.trim())
      const res = await fetch(`/api/manutencoes?${params}`)
      if (res.ok) {
        const data = await res.json()
        setRegistros(data.registros)
        setTotal(data.total)
        setTotalPaginas(data.totalPaginas)
        setResumo(data.resumo)
      }
    } finally {
      setLoading(false)
    }
  }, [filtroStatus, filtroTipo, filtroEspecial, filtroVisivel, busca])

  useEffect(() => { if (usuario) fetchStatuses() }, [fetchStatuses, usuario])

  useEffect(() => {
    const t = setTimeout(() => { setPagina(1); fetchManutencoes(1) }, busca ? 350 : 0)
    return () => clearTimeout(t)
  }, [fetchManutencoes, busca])

  const irPara = (pg: number) => { setPagina(pg); fetchManutencoes(pg) }

  const atualizarLocal = (m: Manutencao) => {
    setRegistros((prev) => {
      const existe = prev.some((r) => r.id === m.id)
      return existe ? prev.map((r) => (r.id === m.id ? m : r)) : [m, ...prev]
    })
    setDetalhe((d) => (d && d.id === m.id ? m : d))
  }

  // ── VISTTO ────────────────────────────────────────────────────────────────
  const vincular = async (desvincular = false) => {
    setVinculando(true)
    try {
      const res = await fetch("/api/vistto/vincular", { method: desvincular ? "DELETE" : "POST" })
      const json = await res.json()
      if (res.ok) { toast.success(json.message); await fetchStatuses(); if (desvincular) fetchManutencoes(1) }
      else toast.error(json.message ?? "Erro na vinculação")
    } finally { setVinculando(false) }
  }

  const sincronizar = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/vistto/sync", { method: "POST" })
      const json = await res.json()
      if (res.ok) { toast.success(`${json.sincronizados} OS sincronizadas`); await fetchStatuses(); irPara(1) }
      else toast.error(json.message ?? "Erro na sincronização")
    } finally { setSyncing(false) }
  }

  const alternarVisivel = async (os: Manutencao, e: React.MouseEvent) => {
    e.stopPropagation()
    const res = await fetch(`/api/manutencoes/${os.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visivelParaMoradores: !os.visivelParaMoradores }),
    })
    if (res.ok) atualizarLocal(await res.json())
    else toast.error("Erro ao atualizar visibilidade")
  }

  // Agrupa por mês
  const porMes = useMemo(() => {
    const grupos = new Map<string, { label: string; items: Manutencao[] }>()
    for (const r of registros) {
      const data = r.agendadoEm ? new Date(r.agendadoEm) : null
      const key = data ? `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}` : "sem-data"
      const label = data ? data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "Sem data agendada"
      if (!grupos.has(key)) grupos.set(key, { label, items: [] })
      grupos.get(key)!.items.push(r)
    }
    return [...grupos.entries()].sort(([a], [b]) => (a === "sem-data" ? -1 : b === "sem-data" ? 1 : b.localeCompare(a)))
  }, [registros])

  const filtrosAtivos = [filtroStatus, filtroTipo, filtroEspecial, filtroVisivel, busca].filter(Boolean).length

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Manutenções"
        descricao={ehPrestador ? "Ordens de serviço atribuídas à sua empresa" : "Preventivas, corretivas, orçamentos e histórico de execução"}
        acoes={
          <>
            {podeOperar(role) && (
              <Button size="sm" onClick={() => setForm({ aberto: true, editando: null })}>
                <Plus className="h-4 w-4 mr-2" /> Registrar manutenção
              </Button>
            )}
            {gestor && (visttoStatus?.vinculado ? (
              <>
                <Button variant="outline" size="sm" onClick={sincronizar} disabled={syncing}>
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sincronizar VISTTO
                </Button>
                <Button variant="ghost" size="sm" onClick={() => vincular(true)} disabled={vinculando} className="text-muted-foreground hover:text-destructive">
                  <Link2Off className="h-4 w-4 mr-2" /> Desvincular
                </Button>
              </>
            ) : visttoStatus && (
              <Button variant="outline" size="sm" onClick={() => vincular()} disabled={vinculando}>
                {vinculando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                Vincular VISTTO
              </Button>
            ))}
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icone={Clock} rotulo="Em aberto" valor={resumo.abertas} />
        <StatCard icone={AlertTriangle} rotulo="Atrasadas" valor={resumo.atrasadas} tom={resumo.atrasadas ? "perigo" : "ok"} />
        <StatCard icone={Receipt} rotulo="Orçamentos p/ aprovar" valor={resumo.orcamentosPendentes} tom={resumo.orcamentosPendentes ? "alerta" : "padrao"} />
        {gestor ? (
          <StatCard
            icone={RefreshCw}
            rotulo="VISTTO"
            valor={visttoStatus?.vinculado ? "Vinculado" : "Não vinculado"}
            detalhe={visttoStatus?.vinculado ? `Último sync: ${fmtRelativo(syncStatus?.ultimoSyncEm ?? null)}` : undefined}
          />
        ) : (
          <StatCard icone={Wrench} rotulo="Total" valor={total} />
        )}
      </div>

      {!ehPrestador && (
        <Pilulas<Aba>
          valor={aba}
          onChange={setAba}
          opcoes={[{ valor: "ordens", rotulo: "Ordens de serviço" }, { valor: "planos", rotulo: "Planos preventivos" }]}
        />
      )}

      {aba === "planos" ? (
        <PlanosPreventivos />
      ) : (
        <>
          {/* Filtros */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por título, equipamento, empresa, local..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
                {busca && (
                  <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <NativeSelect className="w-40 h-9" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                <option value="">Todos os status</option>
                <option value="OPEN">Aberta</option>
                <option value="PENDING">Agendada</option>
                <option value="IN_PROGRESS">Em andamento</option>
                <option value="COMPLETED">Concluída</option>
                <option value="CANCELLED">Cancelada</option>
              </NativeSelect>
              <NativeSelect className="w-36 h-9" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                <option value="">Todos os tipos</option>
                <option value="PREVENTIVA">Preventiva</option>
                <option value="CORRETIVA">Corretiva</option>
              </NativeSelect>
              {gestor && (
                <NativeSelect className="w-40 h-9" value={filtroVisivel} onChange={(e) => setFiltroVisivel(e.target.value)}>
                  <option value="">Visível p/ moradores</option>
                  <option value="true">Visíveis</option>
                  <option value="false">Ocultas</option>
                </NativeSelect>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pilulas<FiltroEspecial>
                valor={filtroEspecial}
                onChange={setFiltroEspecial}
                opcoes={[
                  { valor: "", rotulo: "Todas" },
                  { valor: "atrasadas", rotulo: "Atrasadas", contagem: resumo.atrasadas },
                  { valor: "orcamento", rotulo: "Orçamento pendente", contagem: resumo.orcamentosPendentes },
                ]}
              />
              {filtrosAtivos > 0 && (
                <button
                  onClick={() => { setFiltroStatus(""); setFiltroTipo(""); setFiltroEspecial(""); setFiltroVisivel(""); setBusca("") }}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : registros.length === 0 ? (
            <EstadoVazio
              icone={Wrench}
              titulo={filtrosAtivos ? "Nenhuma manutenção com esses filtros" : "Nenhuma manutenção registrada"}
              descricao={filtrosAtivos ? undefined : "Registre uma manutenção ou crie um plano preventivo para o ZeloH agendar automaticamente."}
            />
          ) : (
            <div className="space-y-6">
              {porMes.map(([mesKey, { label, items }]) => {
                const fechado = mesesFechados.has(mesKey)
                return (
                  <div key={mesKey}>
                    <button
                      onClick={() => setMesesFechados((prev) => {
                        const n = new Set(prev); if (n.has(mesKey)) n.delete(mesKey); else n.add(mesKey); return n
                      })}
                      className="flex items-center gap-3 mb-2 w-full"
                    >
                      <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", fechado && "-rotate-90")} />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                      <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{items.length}</span>
                      <div className="flex-1 h-px bg-border" />
                    </button>

                    {!fechado && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map((os) => {
                          const st = STATUS_CONFIG[os.status] ?? { label: os.status, color: "bg-muted text-muted-foreground border-border", icon: null }
                          const pr = os.prioridade ? PRIORIDADE_CONFIG[os.prioridade] : null
                          const atrasada = estaAtrasada(os)
                          const check = Array.isArray(os.checklist) ? os.checklist : []
                          const feitos = check.filter((c) => c.feito).length
                          return (
                            <button
                              key={os.id}
                              type="button"
                              onClick={() => setDetalhe(os)}
                              className={cn(
                                "text-left rounded-xl border bg-card p-4 flex flex-col gap-2.5 hover:shadow-md hover:border-primary/40 transition-all",
                                atrasada ? "border-red-200" : "border-border"
                              )}
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium", TIPO_CONFIG[os.tipo].color)}>
                                  {TIPO_CONFIG[os.tipo].label}
                                </span>
                                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", st.color)}>
                                  {st.icon}{st.label}
                                </span>
                                {pr && os.prioridade !== "MEDIUM" && (
                                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium", pr.color)}>{pr.label}</span>
                                )}
                                {atrasada && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                    <AlertTriangle className="h-3 w-3" />Atrasada
                                  </span>
                                )}
                                {os.orcamentoStatus === "PENDENTE" && (
                                  <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Orçamento</span>
                                )}
                              </div>

                              <p className="text-sm font-medium text-foreground leading-snug">{os.titulo}</p>

                              <div className="text-xs text-muted-foreground space-y-0.5">
                                {os.equipamento && <p className="flex items-center gap-1 truncate"><Cog className="h-3 w-3 shrink-0" />{os.equipamento.nome}</p>}
                                {(os.prestador?.nome || os.empresaNome || os.prestadorNome) && (
                                  <p className="flex items-center gap-1 truncate"><User className="h-3 w-3 shrink-0" />{os.prestador?.nome ?? os.empresaNome ?? os.prestadorNome}</p>
                                )}
                                {os.agendadoEm && (
                                  <p className={cn("flex items-center gap-1", atrasada && "text-red-600 font-medium")}>
                                    <Calendar className="h-3 w-3 shrink-0" />{formatDate(os.agendadoEm)}
                                  </p>
                                )}
                                {os.valor != null && <p className="font-medium text-foreground">{formatMoeda(os.valor)}</p>}
                              </div>

                              <div className="flex items-center gap-3 mt-auto pt-2 border-t border-border text-[11px] text-muted-foreground">
                                {check.length > 0 && (
                                  <span className={cn("flex items-center gap-1", feitos === check.length && "text-green-700")}>
                                    <ListChecks className="h-3.5 w-3.5" />{feitos}/{check.length}
                                  </span>
                                )}
                                {os.fotos?.length > 0 && <span className="flex items-center gap-1"><Camera className="h-3.5 w-3.5" />{os.fotos.length}</span>}
                                {os.visttoOsCod && <span className="font-mono">#{os.visttoOsCod}</span>}
                                {gestor && (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => alternarVisivel(os, e)}
                                    title={os.visivelParaMoradores ? "Visível aos moradores — clique para ocultar" : "Oculto dos moradores — clique para compartilhar"}
                                    className={cn("ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5", os.visivelParaMoradores ? "text-green-700 bg-green-50" : "hover:bg-muted")}
                                  >
                                    {os.visivelParaMoradores ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                  </span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">{total} registros · Página {pagina} de {totalPaginas}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => irPara(Math.max(1, pagina - 1))} disabled={pagina === 1 || loading}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => irPara(Math.min(totalPaginas, pagina + 1))} disabled={pagina === totalPaginas || loading}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </>
      )}

      <ManutencaoForm
        aberto={form.aberto}
        editando={form.editando}
        onFechar={() => setForm({ aberto: false, editando: null })}
        onSalvo={(m) => { atualizarLocal(m); if (!form.editando) fetchManutencoes(pagina) }}
      />

      <ManutencaoDetalhe
        manutencao={detalhe}
        onFechar={() => setDetalhe(null)}
        onAtualizado={atualizarLocal}
        onEditar={(m) => { setDetalhe(null); setForm({ aberto: true, editando: m }) }}
        onExcluido={(id) => setRegistros((prev) => prev.filter((r) => r.id !== id))}
      />
    </div>
  )
}

export default function ManutencoesPage() {
  return <ModuloGate modulo="manutencoes"><Conteudo /></ModuloGate>
}

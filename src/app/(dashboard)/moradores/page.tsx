"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import {
  Users, UserPlus, Search, Loader2, MoreHorizontal,
  Pencil, PowerOff, Power, Phone, Home, ShieldCheck, Link2,
} from "lucide-react"
import { toast } from "sonner"
import { NativeSelect } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Morador {
  id: string
  nome: string
  email: string
  role: RoleUsuario
  prestadorId?: string | null
  unidade: string | null
  bloco: string | null
  telefone: string | null
  isActive: boolean
  primeiroAcesso: boolean
  createdAt: string
}

interface Totais {
  role: string
  _count: { _all: number }
}

type RoleUsuario = "MORADOR" | "ZELADOR" | "PORTEIRO" | "PRESTADOR" | "CONSELHO" | "SUBSINDICO" | "SINDICO"
type Filtro = "todos" | RoleUsuario
const ROLES_FORM: RoleUsuario[] = ["MORADOR", "ZELADOR", "PORTEIRO", "PRESTADOR", "CONSELHO", "SUBSINDICO", "SINDICO"]
type StatusFiltro = "ativos" | "inativos" | "todos"

const ROLE_CONFIG: Record<string, { label: string; plural: string; color: string }> = {
  SINDICO:  { label: "Síndico",  plural: "Síndicos",   color: "bg-primary/10 text-primary border-primary/20" },
  ZELADOR:  { label: "Zelador",  plural: "Zeladores",  color: "bg-amber-50 text-amber-700 border-amber-200" },
  PORTEIRO: { label: "Porteiro", plural: "Porteiros",  color: "bg-sky-50 text-sky-700 border-sky-200" },
  MORADOR:  { label: "Morador",  plural: "Moradores",  color: "bg-muted text-muted-foreground border-border" },
  SUBSINDICO: { label: "Subsíndico", plural: "Subsíndicos", color: "bg-primary/10 text-primary border-primary/20" },
  CONSELHO:   { label: "Conselho",   plural: "Conselho",    color: "bg-violet-50 text-violet-700 border-violet-200" },
  PRESTADOR:  { label: "Prestador",  plural: "Prestadores", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
}

const initForm = { nome: "", email: "", role: "MORADOR" as Morador["role"], unidade: "", bloco: "", telefone: "", prestadorId: "" }

// ─── Component ───────────────────────────────────────────────────────────────

export default function MoradoresPage() {
  const { usuario } = useAuth()
  const isZelador   = usuario?.role === "ZELADOR" || usuario?.role === "PORTEIRO"

  const [moradores, setMoradores]     = useState<Morador[]>([])
  const [totais, setTotais]           = useState<Totais[]>([])
  const [loading, setLoading]         = useState(true)
  const [busca, setBusca]             = useState("")
  const [filtroRole, setFiltroRole]   = useState<Filtro>("todos")
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("ativos")
  const [filtroBloco, setFiltroBloco] = useState("")
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando]       = useState<Morador | null>(null)
  const [form, setForm]               = useState({ ...initForm })
  const [salvando, setSalvando]       = useState(false)
  const [feedback, setFeedback]       = useState<{ type: "ok" | "erro"; text: string } | null>(null)
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null)

  // Blocos configurados (carregados do condomínio)
  const [blocos, setBlocos] = useState<string[]>([])
  const [prestadores, setPrestadores] = useState<{ id: string; nome: string }[]>([])

  useEffect(() => {
    fetch("/api/prestadores").then(r => r.ok ? r.json() : { prestadores: [] }).then(d => setPrestadores(d.prestadores ?? []))
  }, [])

  const copiarConvite = async (m: Morador) => {
    const res = await fetch(`/api/moradores/${m.id}/convite`, { method: "POST" })
    const data = await res.json()
    if (!res.ok) { toast.error(data.message ?? "Erro ao gerar convite"); return }
    try { await navigator.clipboard.writeText(data.link) } catch { /* sem permissão de clipboard */ }
    toast.success(data.enviado ? "Convite reenviado por e-mail e link copiado" : "Link de convite copiado — envie ao usuário", {
      description: data.enviado ? undefined : data.link,
    })
  }

  const showFeedback = (type: "ok" | "erro", text: string) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4000)
  }

  const fetchMoradores = useCallback(async () => {
    setLoading(true)
    setErroCarregamento(null)
    try {
      const params = new URLSearchParams({ busca, role: filtroRole, status: filtroStatus })
      const res = await fetch(`/api/moradores?${params}`)
      if (res.ok) {
        const data = await res.json()
        setMoradores(data.moradores)
        setTotais(data.totais)
      } else {
        const data = await res.json().catch(() => ({}))
        setErroCarregamento(data.message ?? `Erro ${res.status} ao carregar moradores.`)
      }
    } catch {
      setErroCarregamento("Erro de conexão. Verifique se o servidor está rodando.")
    } finally {
      setLoading(false)
    }
  }, [busca, filtroRole, filtroStatus])

  useEffect(() => {
    const t = setTimeout(fetchMoradores, busca ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchMoradores, busca])

  // Carrega blocos do condomínio
  useEffect(() => {
    fetch("/api/condominio")
      .then(r => r.json())
      .then(d => setBlocos(d.blocos ?? []))
  }, [])

  // Filtra moradores pelo bloco ativo
  const moradoresFiltrados = useMemo(() => {
    if (!filtroBloco) return moradores
    if (filtroBloco === "__sem_bloco__") return moradores.filter(m => !m.bloco?.trim())
    return moradores.filter(m => m.bloco?.trim() === filtroBloco)
  }, [moradores, filtroBloco])

  // Tabs de blocos: "Todos" + blocos configurados + "Sem bloco" (se houver)
  const tabsBlocos = useMemo(() => {
    const tabs: { key: string; label: string }[] = [{ key: "", label: "Todos" }]
    for (const b of blocos) tabs.push({ key: b, label: `Bloco ${b}` })
    const semBloco = moradores.filter(m => !m.bloco?.trim()).length
    if (semBloco > 0) tabs.push({ key: "__sem_bloco__", label: "Sem bloco" })
    return tabs
  }, [blocos, moradores])

  // Abre modal para novo
  const abrirNovo = () => {
    setEditando(null)
    setForm({ ...initForm })
    setModalAberto(true)
  }

  // Abre modal para editar
  const abrirEditar = (m: Morador) => {
    setEditando(m)
    setForm({ nome: m.nome, email: m.email, role: m.role, unidade: m.unidade ?? "", bloco: m.bloco ?? "", telefone: m.telefone ?? "", prestadorId: m.prestadorId ?? "" })
    setModalAberto(true)
  }

  // Salva (criar ou editar)
  const handleSalvar = async () => {
    setSalvando(true)
    try {
      const body: Record<string, unknown> = {
        nome: form.nome, role: form.role,
        email: form.email || undefined,
        unidade: form.unidade || null, bloco: form.bloco || null,
        telefone: form.telefone || null,
        prestadorId: form.role === "PRESTADOR" ? form.prestadorId || null : null,
      }

      const url    = editando ? `/api/moradores/${editando.id}` : "/api/moradores"
      const method = editando ? "PATCH" : "POST"

      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = await res.json()

      if (res.ok) {
        showFeedback("ok", editando ? "Dados atualizados!" : json.conviteEnviado ? "Cadastrado! Convite de acesso enviado por e-mail." : "Cadastrado! Use \"Copiar convite\" para enviar o acesso.")
        setModalAberto(false)
        fetchMoradores()
      } else {
        showFeedback("erro", json.message ?? "Erro ao salvar.")
      }
    } catch {
      showFeedback("erro", "Erro de conexão.")
    } finally {
      setSalvando(false)
    }
  }

  // Ativa/desativa
  const handleToggleAtivo = async (m: Morador) => {
    const res  = await fetch(`/api/moradores/${m.id}`, {
      method: m.isActive ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: m.isActive ? undefined : JSON.stringify({ isActive: true }),
    })
    if (res.ok) {
      showFeedback("ok", m.isActive ? "Acesso desativado." : "Acesso reativado.")
      fetchMoradores()
    } else {
      const json = await res.json()
      showFeedback("erro", json.message ?? "Erro.")
    }
  }

  // Contagens para os cards
  const totalAtivos  = totais.reduce((s, t) => s + t._count._all, 0)
  const totalMorador = totais.find((t) => t.role === "MORADOR")?._count._all ?? 0
  const totalZelador = totais.find((t) => t.role === "ZELADOR")?._count._all ?? 0

  const initials = (nome: string) =>
    nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Moradores</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os moradores e funcionários do condomínio</p>
        </div>
        {!isZelador && (
          <Button size="sm" onClick={abrirNovo}>
            <UserPlus className="h-4 w-4 mr-2" /> Novo cadastro
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

      {/* Erro de carregamento */}
      {erroCarregamento && (
        <div className="rounded-lg px-4 py-3 text-sm font-medium bg-red-50 text-red-800 border border-red-200 flex items-center justify-between">
          <span>{erroCarregamento}</span>
          <button
            onClick={fetchMoradores}
            className="ml-4 underline hover:no-underline text-red-700"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Total ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalAtivos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Home className="h-4 w-4" /> Moradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalMorador}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Funcionários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalZelador}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou unidade..."
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/* Filtro por papel */}
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          {(["todos", ...ROLES_FORM] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFiltroRole(r)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filtroRole === r
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "todos" ? "Todos" : ROLE_CONFIG[r].plural}
            </button>
          ))}
        </div>

        {/* Filtro por status */}
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          {(["ativos", "inativos", "todos"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                filtroStatus === s
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs de bloco */}
      {tabsBlocos.length > 1 && (
        <div className="flex gap-1 flex-wrap rounded-lg border bg-muted/30 p-1 w-fit">
          {tabsBlocos.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFiltroBloco(key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filtroBloco === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Lista em grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : moradoresFiltrados.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 gap-3 text-center">
            <div className="rounded-full bg-muted p-3">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {busca ? "Nenhum resultado para a busca." : "Nenhum morador cadastrado ainda."}
            </p>
            {!busca && !isZelador && (
              <Button size="sm" variant="outline" onClick={abrirNovo}>
                <UserPlus className="h-4 w-4 mr-2" /> Adicionar morador
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {moradoresFiltrados.map((m) => {
            const roleCfg = ROLE_CONFIG[m.role]
            return (
              <Card key={m.id} className={cn("transition-opacity", !m.isActive && "opacity-50")}>
                <CardContent className="p-4 space-y-3">
                  {/* Topo: avatar + nome + menu */}
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {initials(m.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{m.nome}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleCfg.color}`}>
                          {roleCfg.label}
                        </span>
                        {!m.isActive && (
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium bg-red-50 text-red-600 border-red-200">
                            Inativo
                          </span>
                        )}
                        {m.primeiroAcesso && m.isActive && (
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700 border-amber-200">
                            Pendente ativação
                          </span>
                        )}
                      </div>
                    </div>
                    {!isZelador && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => abrirEditar(m)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          {m.primeiroAcesso && m.isActive && !m.email.endsWith("@zeloh.internal") && (
                            <DropdownMenuItem onClick={() => copiarConvite(m)}>
                              <Link2 className="h-4 w-4 mr-2" /> Copiar convite
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleToggleAtivo(m)}
                            className={m.isActive ? "text-destructive focus:text-destructive" : "text-green-700 focus:text-green-700"}
                          >
                            {m.isActive
                              ? <><PowerOff className="h-4 w-4 mr-2" /> Desativar acesso</>
                              : <><Power    className="h-4 w-4 mr-2" /> Reativar acesso</>}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Info */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="truncate">{m.email}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {m.bloco && <span>Bloco {m.bloco}</span>}
                      {m.unidade && (
                        <span className="flex items-center gap-1">
                          <Home className="h-3 w-3" /> Apto {m.unidade}
                        </span>
                      )}
                      {m.telefone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {m.telefone}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal Criar/Editar */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar morador" : "Novo cadastro"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="m-nome">Nome completo</Label>
              <Input id="m-nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="João Silva" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-email">
                E-mail <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
              </Label>
              <Input id="m-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="joao@email.com" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-bloco">Bloco</Label>
                {blocos.length > 0 ? (
                  <select
                    id="m-bloco"
                    value={form.bloco}
                    onChange={e => setForm(f => ({ ...f, bloco: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Sem bloco</option>
                    {blocos.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                ) : (
                  <Input id="m-bloco" value={form.bloco} onChange={(e) => setForm((f) => ({ ...f, bloco: e.target.value }))} placeholder="A" />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-unidade">Apto / Unidade</Label>
                <Input id="m-unidade" value={form.unidade} onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))} placeholder="101" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-telefone">Telefone</Label>
                <Input id="m-telefone" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} placeholder="(11) 9 9999-9999" />
              </div>
            </div>

            {/* Papel */}
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <div className="grid grid-cols-4 gap-2">
                {ROLES_FORM.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, role: r }))}
                    className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                      form.role === r
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {ROLE_CONFIG[r].label}
                  </button>
                ))}
              </div>
              {form.role === "CONSELHO" && (
                <p className="text-xs text-muted-foreground">Conselho vê tudo, aprova orçamentos e despesas, mas não edita cadastros.</p>
              )}
            </div>

            {form.role === "PRESTADOR" && (
              <div className="space-y-1.5">
                <Label>Empresa / prestador vinculado</Label>
                <NativeSelect value={form.prestadorId} onChange={(e) => setForm((f) => ({ ...f, prestadorId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {prestadores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">O prestador vê só as manutenções atribuídas a ele e registra execução, fotos e checklist.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editando ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

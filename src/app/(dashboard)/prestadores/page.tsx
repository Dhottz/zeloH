"use client"

import { useEffect, useState, useCallback } from "react"
import {
  HardHat, Plus, Search, Loader2, MoreHorizontal,
  Pencil, PowerOff, Power, Phone, Mail, Trash2,
  Briefcase, FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Prestador {
  id: string
  nome: string
  especialidade: string | null
  cnpj: string | null
  cpf: string | null
  telefone: string | null
  email: string | null
  observacoes: string | null
  ativo: boolean
  createdAt: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

export const ESPECIALIDADES = [
  "Hidráulica",
  "Elétrica",
  "Pintura",
  "Limpeza",
  "Segurança",
  "Jardinagem",
  "Elevadores",
  "Ar Condicionado",
  "Estrutura / Civil",
  "TI / Câmeras",
  "Geral",
]

const ESP_COLOR: Record<string, string> = {
  "Hidráulica":       "bg-blue-50   text-blue-700   border-blue-200",
  "Elétrica":         "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Pintura":          "bg-pink-50   text-pink-700   border-pink-200",
  "Limpeza":          "bg-green-50  text-green-700  border-green-200",
  "Segurança":        "bg-red-50    text-red-700    border-red-200",
  "Jardinagem":       "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Elevadores":       "bg-purple-50 text-purple-700 border-purple-200",
  "Ar Condicionado":  "bg-cyan-50   text-cyan-700   border-cyan-200",
  "Estrutura / Civil":"bg-orange-50 text-orange-700 border-orange-200",
  "TI / Câmeras":     "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Geral":            "bg-muted     text-muted-foreground border-border",
}

function formatDoc(v: string | null, tipo: "cnpj" | "cpf") {
  if (!v) return null
  const d = v.replace(/\D/g, "")
  if (tipo === "cnpj" && d.length === 14)
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
  if (tipo === "cpf" && d.length === 11)
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
  return v
}

const initForm = {
  nome: "", especialidade: "", cnpj: "", cpf: "",
  telefone: "", email: "", observacoes: "",
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PrestadoresPage() {
  const { usuario } = useAuth()
  const isZelador   = usuario?.role === "ZELADOR" || usuario?.role === "PORTEIRO"

  const [prestadores, setPrestadores] = useState<Prestador[]>([])
  const [total, setTotal]             = useState(0)
  const [ativos, setAtivos]           = useState(0)
  const [loading, setLoading]         = useState(true)
  const [busca, setBusca]             = useState("")
  const [filtroEsp, setFiltroEsp]     = useState("")
  const [filtroStatus, setFiltroStatus] = useState<"ativos" | "inativos" | "todos">("ativos")
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando]       = useState<Prestador | null>(null)
  const [form, setForm]               = useState({ ...initForm })
  const [salvando, setSalvando]       = useState(false)
  const [confirmarExcluir, setConfirmarExcluir] = useState<string | null>(null)
  const [feedback, setFeedback]       = useState<{ type: "ok" | "erro"; text: string } | null>(null)

  const showFeedback = (type: "ok" | "erro", text: string) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4000)
  }

  const fetchPrestadores = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ busca, status: filtroStatus })
      if (filtroEsp) params.set("especialidade", filtroEsp)
      const res = await fetch(`/api/prestadores?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPrestadores(data.prestadores)
        setTotal(data.total)
        setAtivos(data.ativos)
      }
    } finally {
      setLoading(false)
    }
  }, [busca, filtroEsp, filtroStatus])

  useEffect(() => {
    const t = setTimeout(fetchPrestadores, busca ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchPrestadores, busca])

  const abrirNovo = () => {
    setEditando(null)
    setForm({ ...initForm })
    setModalAberto(true)
  }

  const abrirEditar = (p: Prestador) => {
    setEditando(p)
    setForm({
      nome:          p.nome,
      especialidade: p.especialidade ?? "",
      cnpj:          p.cnpj ? formatDoc(p.cnpj, "cnpj") ?? "" : "",
      cpf:           p.cpf  ? formatDoc(p.cpf,  "cpf")  ?? "" : "",
      telefone:      p.telefone   ?? "",
      email:         p.email      ?? "",
      observacoes:   p.observacoes ?? "",
    })
    setModalAberto(true)
  }

  const handleSalvar = async () => {
    setSalvando(true)
    try {
      const body = {
        nome:          form.nome,
        especialidade: form.especialidade || null,
        cnpj:          form.cnpj     || null,
        cpf:           form.cpf      || null,
        telefone:      form.telefone || null,
        email:         form.email    || undefined,
        observacoes:   form.observacoes || null,
      }
      const url    = editando ? `/api/prestadores/${editando.id}` : "/api/prestadores"
      const method = editando ? "PATCH" : "POST"
      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = await res.json()
      if (res.ok) {
        showFeedback("ok", editando ? "Prestador atualizado!" : "Prestador cadastrado!")
        setModalAberto(false)
        fetchPrestadores()
      } else {
        showFeedback("erro", json.message ?? "Erro ao salvar.")
      }
    } catch {
      showFeedback("erro", "Erro de conexão.")
    } finally {
      setSalvando(false)
    }
  }

  const handleToggleAtivo = async (p: Prestador) => {
    const res = await fetch(`/api/prestadores/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !p.ativo }),
    })
    if (res.ok) {
      showFeedback("ok", p.ativo ? "Prestador desativado." : "Prestador reativado.")
      fetchPrestadores()
    }
  }

  const handleExcluir = async (id: string) => {
    const res = await fetch(`/api/prestadores/${id}`, { method: "DELETE" })
    if (res.ok) {
      showFeedback("ok", "Prestador excluído.")
      setConfirmarExcluir(null)
      fetchPrestadores()
    } else {
      showFeedback("erro", "Erro ao excluir.")
    }
  }

  const initials = (nome: string) =>
    nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Prestadores</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastro de empresas e profissionais de serviço</p>
        </div>
        {!isZelador && (
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="h-4 w-4 mr-2" /> Novo prestador
          </Button>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={cn(
          "rounded-lg px-4 py-3 text-sm font-medium border",
          feedback.type === "ok"
            ? "bg-green-50 text-green-800 border-green-200"
            : "bg-red-50 text-red-800 border-red-200"
        )}>
          {feedback.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <HardHat className="h-4 w-4" /> Total cadastrado
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Ativos
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{ativos}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Especialidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {new Set(prestadores.map(p => p.especialidade).filter(Boolean)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou CNPJ..."
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/* Filtro especialidade */}
        <div className="flex gap-1 flex-wrap rounded-lg border bg-muted/30 p-1">
          <button
            onClick={() => setFiltroEsp("")}
            className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors",
              !filtroEsp ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Todos
          </button>
          {ESPECIALIDADES.map((e) => (
            <button
              key={e}
              onClick={() => setFiltroEsp(filtroEsp === e ? "" : e)}
              className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors",
                filtroEsp === e ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Filtro status */}
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          {(["ativos", "inativos", "todos"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                filtroStatus === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : prestadores.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 gap-3 text-center">
            <div className="rounded-full bg-muted p-3">
              <HardHat className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {busca || filtroEsp ? "Nenhum resultado para os filtros aplicados." : "Nenhum prestador cadastrado ainda."}
            </p>
            {!busca && !filtroEsp && !isZelador && (
              <Button size="sm" variant="outline" onClick={abrirNovo}>
                <Plus className="h-4 w-4 mr-2" /> Cadastrar prestador
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {prestadores.map((p) => {
            const espColor = p.especialidade ? (ESP_COLOR[p.especialidade] ?? ESP_COLOR["Geral"]) : null
            return (
              <Card key={p.id} className={cn("transition-opacity", !p.ativo && "opacity-50")}>
                <CardContent className="p-4 space-y-3">
                  {/* Topo: iniciais + nome + menu */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {initials(p.nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{p.nome}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {p.especialidade && espColor && (
                          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", espColor)}>
                            {p.especialidade}
                          </span>
                        )}
                        {!p.ativo && (
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium bg-red-50 text-red-600 border-red-200">
                            Inativo
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
                          <DropdownMenuItem onClick={() => abrirEditar(p)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleAtivo(p)}
                            className={p.ativo ? "text-amber-600 focus:text-amber-600" : "text-green-700 focus:text-green-700"}
                          >
                            {p.ativo
                              ? <><PowerOff className="h-4 w-4 mr-2" /> Desativar</>
                              : <><Power    className="h-4 w-4 mr-2" /> Reativar</>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setConfirmarExcluir(p.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Contatos */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {p.telefone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 shrink-0" /> {p.telefone}
                      </span>
                    )}
                    {p.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{p.email}</span>
                      </span>
                    )}
                    {(p.cnpj || p.cpf) && (
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3 w-3 shrink-0" />
                        {p.cnpj ? formatDoc(p.cnpj, "cnpj") : formatDoc(p.cpf, "cpf")}
                      </span>
                    )}
                  </div>

                  {/* Observações */}
                  {p.observacoes && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 border-t border-border pt-2">
                      {p.observacoes}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal criar/editar */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar prestador" : "Novo prestador"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-nome">Nome / Razão social</Label>
              <Input id="p-nome" value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Hidro Serviços Ltda" />
            </div>

            {/* Especialidade */}
            <div className="space-y-1.5">
              <Label>Especialidade</Label>
              <div className="flex flex-wrap gap-1.5">
                {ESPECIALIDADES.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, especialidade: f.especialidade === e ? "" : e }))}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                      form.especialidade === e
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Documento */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-cnpj">CNPJ <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
                <Input id="p-cnpj" value={form.cnpj} onChange={(e) => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-cpf">CPF <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
                <Input id="p-cpf" value={form.cpf} onChange={(e) => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
              </div>
            </div>

            {/* Contato */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-tel">Telefone</Label>
                <Input id="p-tel" value={form.telefone} onChange={(e) => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-email">E-mail <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
                <Input id="p-email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@empresa.com" />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="p-obs">Observações <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
              <textarea
                id="p-obs"
                rows={3}
                value={form.observacoes}
                onChange={(e) => setForm(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Notas, avaliação, horário de atendimento..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando || !form.nome.trim()}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editando ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal confirmar exclusão */}
      <Dialog open={!!confirmarExcluir} onOpenChange={() => setConfirmarExcluir(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir prestador?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Esta ação é permanente e não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarExcluir(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmarExcluir && handleExcluir(confirmarExcluir)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

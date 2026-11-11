"use client"

import { useCallback, useEffect, useState } from "react"
import { Building2, Plus, Loader2, AlertCircle, Wrench, Users, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { PageHeader } from "@/components/shared/page-header"
import { useAuth } from "@/hooks/use-auth"
import { PLANOS, type PlanoId } from "@/lib/planos"
import { ROLE_LABEL, type Role } from "@/lib/permissions"
import { cn } from "@/lib/utils"

interface Condo {
  id: string
  nome: string
  cidade: string | null
  estado: string | null
  plano: PlanoId
  assinaturaStatus: string
  role: string
  moradores: number
  ocorrenciasAbertas: number
  manutencoesAtrasadas: number
}

const STATUS: Record<string, { label: string; cor: string }> = {
  TRIAL:        { label: "Em teste",  cor: "bg-blue-100 text-blue-700" },
  ATIVA:        { label: "Ativa",     cor: "bg-green-100 text-green-700" },
  INADIMPLENTE: { label: "Pendente",  cor: "bg-red-100 text-red-700" },
  CANCELADA:    { label: "Cancelada", cor: "bg-muted text-muted-foreground" },
}

export default function CondominiosPage() {
  const { trocarCondominio } = useAuth()
  const [lista, setLista] = useState<Condo[]>([])
  const [ativo, setAtivo] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ nome: "", cnpj: "", cidade: "", estado: "" })

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/condominios")
    if (res.ok) {
      const data = await res.json()
      setLista(data.condominios)
      setAtivo(data.condominioAtivo)
    }
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const criar = async () => {
    setSalvando(true)
    const res = await fetch("/api/condominios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSalvando(false)
    if (!res.ok) { toast.error(data.message ?? "Erro ao cadastrar"); return }
    toast.success("Condomínio cadastrado")
    setModal(false)
    setForm({ nome: "", cnpj: "", cidade: "", estado: "" })
    carregar()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Meus condomínios"
        descricao="Síndicos profissionais e administradoras gerenciam vários condomínios com um único login."
        acoes={<Button size="sm" onClick={() => setModal(true)}><Plus className="w-4 h-4 mr-2" />Novo condomínio</Button>}
      />

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map((c) => {
            const st = STATUS[c.assinaturaStatus] ?? STATUS.ATIVA
            return (
              <div key={c.id} className={cn("rounded-xl border bg-card p-4 space-y-3", c.id === ativo ? "border-primary" : "border-border")}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {[c.cidade, c.estado].filter(Boolean).join(" / ") || "—"} · {ROLE_LABEL[c.role as Role] ?? c.role}
                    </p>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", st.cor)}>{st.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/40 py-2">
                    <Users className="w-3.5 h-3.5 mx-auto text-muted-foreground" />
                    <p className="text-sm font-semibold">{c.moradores}</p>
                    <p className="text-[10px] text-muted-foreground">moradores</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 py-2">
                    <AlertCircle className="w-3.5 h-3.5 mx-auto text-muted-foreground" />
                    <p className="text-sm font-semibold">{c.ocorrenciasAbertas}</p>
                    <p className="text-[10px] text-muted-foreground">ocorrências</p>
                  </div>
                  <div className={cn("rounded-lg py-2", c.manutencoesAtrasadas ? "bg-red-50" : "bg-muted/40")}>
                    <Wrench className={cn("w-3.5 h-3.5 mx-auto", c.manutencoesAtrasadas ? "text-red-600" : "text-muted-foreground")} />
                    <p className="text-sm font-semibold">{c.manutencoesAtrasadas}</p>
                    <p className="text-[10px] text-muted-foreground">atrasadas</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Plano {PLANOS[c.plano]?.nome}</span>
                  {c.id === ativo ? (
                    <span className="text-xs font-medium text-primary">Ativo agora</span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => trocarCondominio(c.id)}>
                      Abrir <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo condomínio</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Residencial Jardim das Flores" />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
            </div>
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>UF</Label>
                <Input maxLength={2} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={criar} disabled={salvando || form.nome.trim().length < 2}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

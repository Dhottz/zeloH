"use client"

import { useCallback, useEffect, useState } from "react"
import {
  FileSignature, FileBadge, Plus, Loader2, MoreHorizontal, Pencil, Trash2, Archive, Phone, Cog, Paperclip,
  AlertTriangle, CalendarClock, Wallet, RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea, NativeSelect } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PageHeader, EstadoVazio, StatCard, Pilulas } from "@/components/shared/page-header"
import { ModuloGate } from "@/components/shared/modulo-gate"
import { ArquivoUnicoInput } from "@/components/shared/arquivos-input"
import { useOpcoesManutencao } from "@/components/manutencoes/tipos"
import { useAuth } from "@/hooks/use-auth"
import { podeGerenciar } from "@/lib/permissions"
import { TIPOS_CERTIFICADO, rotuloCertificado } from "@/lib/equipamentos"
import { urlArquivo } from "@/lib/arquivos"
import { cn, diasAte, formatDate, formatMoeda, paraInputData, textoPrazo } from "@/lib/utils"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Contrato {
  id: string
  titulo: string
  objeto: string | null
  valor: string | null
  periodicidade: string
  inicio: string
  fim: string | null
  renovacaoAutomatica: boolean
  avisoDias: number
  arquivo: string | null
  observacoes: string | null
  ativo: boolean
  prestadorId: string | null
  prestador: { id: string; nome: string; telefone: string | null; email: string | null } | null
  equipamentos: { id: string; nome: string }[]
}

interface Certificado {
  id: string
  tipo: string
  titulo: string
  numero: string | null
  emissor: string | null
  emitidoEm: string | null
  validoAte: string | null
  arquivo: string | null
  observacoes: string | null
  equipamentoId: string | null
  prestadorId: string | null
  equipamento: { id: string; nome: string } | null
  prestador: { id: string; nome: string } | null
}

const PERIODICIDADE: Record<string, string> = {
  MENSAL: "mensal", TRIMESTRAL: "trimestral", SEMESTRAL: "semestral", ANUAL: "anual", AVULSO: "avulso",
}

function situacao(fim: string | null, avisoDias: number, ativo = true) {
  if (!ativo) return { rotulo: "Encerrado", cor: "bg-muted text-muted-foreground" }
  const d = diasAte(fim)
  if (d === null) return { rotulo: "Sem vencimento", cor: "bg-blue-50 text-blue-700" }
  if (d < 0) return { rotulo: "Vencido", cor: "bg-red-100 text-red-700" }
  if (d <= avisoDias) return { rotulo: textoPrazo(fim), cor: "bg-amber-100 text-amber-800" }
  return { rotulo: "Vigente", cor: "bg-green-50 text-green-700" }
}

// ─── Formulário de contrato ───────────────────────────────────────────────────

const contratoVazio = {
  titulo: "", objeto: "", prestadorId: "", valor: "", periodicidade: "MENSAL", inicio: "", fim: "",
  renovacaoAutomatica: false, avisoDias: 30, arquivo: null as string | null, observacoes: "", equipamentoIds: [] as string[],
}

function ContratoForm({ aberto, onFechar, onSalvo, editando }: { aberto: boolean; onFechar: () => void; onSalvo: () => void; editando: Contrato | null }) {
  const { equipamentos, prestadores } = useOpcoesManutencao(aberto)
  const [form, setForm] = useState({ ...contratoVazio })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setForm(editando ? {
      titulo: editando.titulo, objeto: editando.objeto ?? "", prestadorId: editando.prestadorId ?? "",
      valor: editando.valor ? String(Number(editando.valor)).replace(".", ",") : "", periodicidade: editando.periodicidade,
      inicio: paraInputData(editando.inicio), fim: paraInputData(editando.fim), renovacaoAutomatica: editando.renovacaoAutomatica,
      avisoDias: editando.avisoDias, arquivo: editando.arquivo, observacoes: editando.observacoes ?? "",
      equipamentoIds: editando.equipamentos.map((e) => e.id),
    } : { ...contratoVazio })
  }, [aberto, editando])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const salvar = async () => {
    setSalvando(true)
    try {
      const res = await fetch(editando ? `/api/contratos/${editando.id}` : "/api/contratos", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: form.titulo, objeto: form.objeto || null, prestadorId: form.prestadorId || null,
          valor: form.valor ? parseFloat(form.valor.replace(/\./g, "").replace(",", ".")) : null,
          periodicidade: form.periodicidade, inicio: form.inicio, fim: form.fim || null,
          renovacaoAutomatica: form.renovacaoAutomatica, avisoDias: Number(form.avisoDias),
          arquivo: form.arquivo, observacoes: form.observacoes || null, equipamentoIds: form.equipamentoIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message ?? "Erro ao salvar"); return }
      toast.success(editando ? "Contrato atualizado" : "Contrato cadastrado")
      onSalvo(); onFechar()
    } finally { setSalvando(false) }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editando ? "Editar contrato" : "Novo contrato"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex: Manutenção dos elevadores" />
          </div>
          <div className="space-y-1.5">
            <Label>Fornecedor</Label>
            <NativeSelect value={form.prestadorId} onChange={(e) => set("prestadorId", e.target.value)}>
              <option value="">— Selecione —</option>
              {prestadores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label>Objeto do contrato</Label>
            <Textarea rows={2} value={form.objeto} onChange={(e) => set("objeto", e.target.value)} placeholder="Escopo dos serviços, SLA, visitas incluídas..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input inputMode="decimal" value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Cobrança</Label>
              <NativeSelect value={form.periodicidade} onChange={(e) => set("periodicidade", e.target.value)}>
                <option value="MENSAL">Mensal</option>
                <option value="TRIMESTRAL">Trimestral</option>
                <option value="SEMESTRAL">Semestral</option>
                <option value="ANUAL">Anual</option>
                <option value="AVULSO">Valor único</option>
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início *</Label>
              <Input type="date" value={form.inicio} onChange={(e) => set("inicio", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim da vigência</Label>
              <Input type="date" value={form.fim} onChange={(e) => set("fim", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Avisar com antecedência de</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} value={form.avisoDias} onChange={(e) => set("avisoDias", Number(e.target.value))} />
                <span className="text-xs text-muted-foreground">dias</span>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm pb-1.5">
              <input type="checkbox" className="h-4 w-4 accent-[#B84A2E]" checked={form.renovacaoAutomatica} onChange={(e) => set("renovacaoAutomatica", e.target.checked)} />
              Renovação automática
            </label>
          </div>
          {equipamentos.length > 0 && (
            <div className="space-y-1.5">
              <Label>Equipamentos cobertos</Label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {equipamentos.map((e) => {
                  const sel = form.equipamentoIds.includes(e.id)
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => set("equipamentoIds", sel ? form.equipamentoIds.filter((x) => x !== e.id) : [...form.equipamentoIds, e.id])}
                      className={cn("px-2.5 py-1 rounded-lg text-xs border transition-colors", sel ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}
                    >
                      {e.nome}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Contrato digitalizado</Label>
            <ArquivoUnicoInput valor={form.arquivo} onChange={(v) => set("arquivo", v)} pasta="contratos" rotulo="Anexar contrato (PDF)" />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || form.titulo.trim().length < 3 || !form.inicio}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Formulário de certificado ────────────────────────────────────────────────

const certVazio = {
  tipo: "AVCB", titulo: "", numero: "", emissor: "", emitidoEm: "", validoAte: "",
  arquivo: null as string | null, equipamentoId: "", prestadorId: "", observacoes: "",
}

function CertificadoForm({ aberto, onFechar, onSalvo, editando }: { aberto: boolean; onFechar: () => void; onSalvo: () => void; editando: Certificado | null }) {
  const { equipamentos, prestadores } = useOpcoesManutencao(aberto)
  const [form, setForm] = useState({ ...certVazio })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setForm(editando ? {
      tipo: editando.tipo, titulo: editando.titulo, numero: editando.numero ?? "", emissor: editando.emissor ?? "",
      emitidoEm: paraInputData(editando.emitidoEm), validoAte: paraInputData(editando.validoAte), arquivo: editando.arquivo,
      equipamentoId: editando.equipamentoId ?? "", prestadorId: editando.prestadorId ?? "", observacoes: editando.observacoes ?? "",
    } : { ...certVazio, titulo: rotuloCertificado("AVCB") })
  }, [aberto, editando])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const salvar = async () => {
    setSalvando(true)
    try {
      const res = await fetch(editando ? `/api/certificados/${editando.id}` : "/api/certificados", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          numero: form.numero || null, emissor: form.emissor || null, emitidoEm: form.emitidoEm || null,
          validoAte: form.validoAte || null, equipamentoId: form.equipamentoId || null,
          prestadorId: form.prestadorId || null, observacoes: form.observacoes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message ?? "Erro ao salvar"); return }
      toast.success(editando ? "Atualizado" : "Cadastrado")
      onSalvo(); onFechar()
    } finally { setSalvando(false) }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editando ? "Editar certificado" : "Novo certificado ou laudo"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <NativeSelect
              value={form.tipo}
              onChange={(e) => setForm((f) => ({
                ...f, tipo: e.target.value,
                titulo: !f.titulo || TIPOS_CERTIFICADO.some((t) => t.rotulo === f.titulo) ? rotuloCertificado(e.target.value) : f.titulo,
              }))}
            >
              {TIPOS_CERTIFICADO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Número</Label><Input value={form.numero} onChange={(e) => set("numero", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Emissor</Label><Input value={form.emissor} onChange={(e) => set("emissor", e.target.value)} placeholder="Corpo de Bombeiros, empresa..." /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Emitido em</Label><Input type="date" value={form.emitidoEm} onChange={(e) => set("emitidoEm", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Válido até</Label><Input type="date" value={form.validoAte} onChange={(e) => set("validoAte", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Equipamento</Label>
              <NativeSelect value={form.equipamentoId} onChange={(e) => set("equipamentoId", e.target.value)}>
                <option value="">— Nenhum —</option>
                {equipamentos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label>Empresa responsável</Label>
              <NativeSelect value={form.prestadorId} onChange={(e) => set("prestadorId", e.target.value)}>
                <option value="">— Nenhuma —</option>
                {prestadores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Documento</Label>
            <ArquivoUnicoInput valor={form.arquivo} onChange={(v) => set("arquivo", v)} pasta="certificados" />
          </div>
          <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={2} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || form.titulo.trim().length < 2}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

type Aba = "contratos" | "certificados"

function Conteudo() {
  const { usuario } = useAuth()
  const gestor = podeGerenciar(usuario?.role)
  const [aba, setAba] = useState<Aba>("contratos")
  const [status, setStatus] = useState<"ativos" | "encerrados">("ativos")
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [certificados, setCertificados] = useState<Certificado[]>([])
  const [loading, setLoading] = useState(true)
  const [formContrato, setFormContrato] = useState<{ aberto: boolean; editando: Contrato | null }>({ aberto: false, editando: null })
  const [formCert, setFormCert] = useState<{ aberto: boolean; editando: Certificado | null }>({ aberto: false, editando: null })

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("aba") === "certificados") setAba("certificados")
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    const [c, k] = await Promise.all([fetch(`/api/contratos?status=${status}`), fetch("/api/certificados")])
    if (c.ok) setContratos((await c.json()).contratos)
    if (k.ok) setCertificados((await k.json()).certificados)
    setLoading(false)
  }, [status])

  useEffect(() => { carregar() }, [carregar])

  const vencendo = contratos.filter((c) => { const d = diasAte(c.fim); return c.ativo && d !== null && d <= c.avisoDias }).length
  const certVencendo = certificados.filter((c) => { const d = diasAte(c.validoAte); return d !== null && d <= 30 }).length
  const custoMensal = contratos.filter((c) => c.ativo && c.valor).reduce((s, c) => {
    const v = Number(c.valor)
    const mensal: Record<string, number> = { MENSAL: v, TRIMESTRAL: v / 3, SEMESTRAL: v / 6, ANUAL: v / 12 }
    return s + (mensal[c.periodicidade] ?? 0)
  }, 0)

  const contratoAcao = async (c: Contrato, acao: "encerrar" | "excluir") => {
    if (acao === "excluir" && !confirm(`Excluir o contrato "${c.titulo}"?`)) return
    const res = acao === "excluir"
      ? await fetch(`/api/contratos/${c.id}`, { method: "DELETE" })
      : await fetch(`/api/contratos/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ativo: !c.ativo }) })
    if (res.ok) { toast.success(acao === "excluir" ? "Contrato excluído" : c.ativo ? "Contrato encerrado" : "Contrato reativado"); carregar() }
  }

  const excluirCert = async (c: Certificado) => {
    if (!confirm(`Excluir "${c.titulo}"?`)) return
    const res = await fetch(`/api/certificados/${c.id}`, { method: "DELETE" })
    if (res.ok) { toast.success("Excluído"); carregar() }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Contratos e certificados"
        descricao="Vigências, valores, fornecedores e documentos obrigatórios com alerta de vencimento."
        acoes={gestor && (
          aba === "contratos"
            ? <Button size="sm" onClick={() => setFormContrato({ aberto: true, editando: null })}><Plus className="h-4 w-4 mr-2" />Novo contrato</Button>
            : <Button size="sm" onClick={() => setFormCert({ aberto: true, editando: null })}><Plus className="h-4 w-4 mr-2" />Novo certificado</Button>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icone={FileSignature} rotulo="Contratos ativos" valor={contratos.filter((c) => c.ativo).length} />
        <StatCard icone={CalendarClock} rotulo="Contratos a vencer" valor={vencendo} tom={vencendo ? "alerta" : "ok"} />
        <StatCard icone={FileBadge} rotulo="Certificados vencendo/vencidos" valor={certVencendo} tom={certVencendo ? "perigo" : "ok"} />
        <StatCard icone={Wallet} rotulo="Custo mensal em contratos" valor={formatMoeda(custoMensal)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Pilulas<Aba> valor={aba} onChange={setAba} opcoes={[
          { valor: "contratos", rotulo: "Contratos", contagem: contratos.length },
          { valor: "certificados", rotulo: "Certificados e laudos", contagem: certificados.length },
        ]} />
        {aba === "contratos" && (
          <Pilulas<"ativos" | "encerrados"> valor={status} onChange={setStatus} opcoes={[
            { valor: "ativos", rotulo: "Ativos" }, { valor: "encerrados", rotulo: "Encerrados" },
          ]} />
        )}
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : aba === "contratos" ? (
        contratos.length === 0 ? (
          <EstadoVazio icone={FileSignature} titulo={status === "ativos" ? "Nenhum contrato ativo" : "Nenhum contrato encerrado"} descricao="Cadastre os contratos de elevador, limpeza, portaria, seguro... e receba alerta antes do vencimento." />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {contratos.map((c) => {
              const sit = situacao(c.fim, c.avisoDias, c.ativo)
              return (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{c.titulo}</p>
                      <p className="text-xs text-muted-foreground">{c.prestador?.nome ?? "Fornecedor não informado"}</p>
                    </div>
                    <span className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0", sit.cor)}>{sit.rotulo}</span>
                    {gestor && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setFormContrato({ aberto: true, editando: c })}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => contratoAcao(c, "encerrar")}>
                            {c.ativo ? <><Archive className="h-4 w-4 mr-2" />Encerrar</> : <><RefreshCw className="h-4 w-4 mr-2" />Reativar</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => contratoAcao(c, "excluir")} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {c.objeto && <p className="text-xs text-muted-foreground line-clamp-2">{c.objeto}</p>}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><p className="text-muted-foreground">Valor</p><p className="font-medium">{c.valor ? `${formatMoeda(c.valor)} ${PERIODICIDADE[c.periodicidade] ?? ""}` : "—"}</p></div>
                    <div><p className="text-muted-foreground">Vigência</p><p className="font-medium">{formatDate(c.inicio)} → {c.fim ? formatDate(c.fim) : "indeterminado"}</p></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground border-t border-border pt-2">
                    {c.renovacaoAutomatica && <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />Renova automaticamente</span>}
                    {c.equipamentos.length > 0 && <span className="flex items-center gap-1"><Cog className="h-3 w-3" />{c.equipamentos.map((e) => e.nome).join(", ")}</span>}
                    {c.prestador?.telefone && <a href={`tel:${c.prestador.telefone}`} className="flex items-center gap-1 hover:text-primary"><Phone className="h-3 w-3" />{c.prestador.telefone}</a>}
                    {c.arquivo && <a href={urlArquivo(c.arquivo)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline ml-auto"><Paperclip className="h-3 w-3" />Contrato</a>}
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : certificados.length === 0 ? (
        <EstadoVazio icone={FileBadge} titulo="Nenhum certificado cadastrado" descricao="AVCB, laudo SPDA, limpeza de reservatórios, extintores, seguro... o ZeloH avisa antes de vencer." />
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {certificados.map((c) => {
            const d = diasAte(c.validoAte)
            const vencido = d !== null && d < 0
            const proximo = d !== null && d >= 0 && d <= 30
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className={cn("rounded-lg p-2 shrink-0", vencido ? "bg-red-100 text-red-700" : proximo ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary")}>
                  {vencido ? <AlertTriangle className="h-4 w-4" /> : <FileBadge className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.titulo}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {rotuloCertificado(c.tipo)}{c.equipamento ? ` · ${c.equipamento.nome}` : ""}{c.prestador ? ` · ${c.prestador.nome}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn("text-xs font-medium", vencido ? "text-red-600" : proximo ? "text-amber-700" : "text-muted-foreground")}>
                    {c.validoAte ? textoPrazo(c.validoAte) : "Sem validade"}
                  </p>
                  {c.validoAte && <p className="text-[11px] text-muted-foreground">{formatDate(c.validoAte)}</p>}
                </div>
                {c.arquivo && <a href={urlArquivo(c.arquivo)} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Abrir</a>}
                {gestor && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setFormCert({ aberto: true, editando: c })}><Pencil className="h-4 w-4 mr-2" />Editar / renovar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => excluirCert(c)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ContratoForm aberto={formContrato.aberto} editando={formContrato.editando} onFechar={() => setFormContrato({ aberto: false, editando: null })} onSalvo={carregar} />
      <CertificadoForm aberto={formCert.aberto} editando={formCert.editando} onFechar={() => setFormCert({ aberto: false, editando: null })} onSalvo={carregar} />
    </div>
  )
}

export default function ContratosPage() {
  return <ModuloGate modulo="contratos"><Conteudo /></ModuloGate>
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Wallet, Plus, Loader2, CheckCircle2, XCircle, Receipt, Clock, TrendingUp, MoreHorizontal, Trash2,
  Printer, Banknote, Undo2, Paperclip,
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
import { podeAprovar, podeGerenciar } from "@/lib/permissions"
import { CATEGORIAS_DESPESA, STATUS_DESPESA, MESES } from "@/lib/financeiro"
import { urlArquivo } from "@/lib/arquivos"
import { cn, formatDate, formatMoeda } from "@/lib/utils"

interface Despesa {
  id: string
  descricao: string
  categoria: string
  valor: string
  competencia: string
  vencimento: string | null
  status: keyof typeof STATUS_DESPESA
  pagoEm: string | null
  comprovante: string | null
  notaFiscal: string | null
  criadoPor: string | null
  aprovadoPor: string | null
  observacoes: string | null
  prestador: { id: string; nome: string } | null
  equipamento: { id: string; nome: string } | null
  manutencao: { id: string; titulo: string } | null
}

interface Relatorio {
  ano: number
  linhas: { categoria: string; orcadoMensal: number; orcadoAno: number; realizadoMes: number[]; realizado: number }[]
  totalMes: number[]
  orcadoMensalTotal: number
  orcadoAnoTotal: number
  realizadoAnoTotal: number
  porEquipamento: { id: string; nome: string; total: number; quantidade: number }[]
  porPrestador: { id: string; nome: string; total: number; quantidade: number }[]
}

type Aba = "despesas" | "orcamento" | "relatorio"

const moedaCurta = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : formatMoeda(v)

// ─── Gráfico: realizado por mês × orçado mensal ───────────────────────────────

function GraficoMensal({ totalMes, orcado }: { totalMes: number[]; orcado: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(orcado, ...totalMes, 1) * 1.1
  const altura = 180
  const yOrcado = altura - (orcado / max) * altura

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <p className="text-sm font-medium">Despesas realizadas por mês</p>
        {orcado > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-foreground/50" /> Orçado: {formatMoeda(orcado)}/mês
          </p>
        )}
      </div>
      <div className="relative" style={{ height: altura }}>
        {/* grade recessiva */}
        {[0.25, 0.5, 0.75].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-border/60" style={{ top: altura * f }} />
        ))}
        <div className="absolute inset-x-0 bottom-0 border-t border-border" />
        {/* barras */}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {totalMes.map((v, i) => {
            const h = (v / max) * altura
            const acima = orcado > 0 && v > orcado
            return (
              <div
                key={i}
                className="relative flex-1 h-full flex items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={cn("w-full max-w-7 rounded-t-[4px] transition-opacity", hover !== null && hover !== i && "opacity-50")}
                  style={{ height: Math.max(v > 0 ? 2 : 0, h), background: "#B84A2E" }}
                />
                {hover === i && (
                  <div className="absolute bottom-full mb-1 z-10 whitespace-nowrap rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs shadow-md pointer-events-none" style={{ bottom: h + 6 }}>
                    <p className="font-medium text-foreground">{MESES[i]}: {formatMoeda(v)}</p>
                    {orcado > 0 && (
                      <p className="text-muted-foreground">
                        {acima ? `▲ ${formatMoeda(v - orcado)} acima do orçado` : `${formatMoeda(orcado - v)} abaixo do orçado`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* linha de referência do orçado */}
        {orcado > 0 && (
          <div className="absolute inset-x-0 border-t-2 border-dashed border-foreground/50 pointer-events-none" style={{ top: yOrcado }} />
        )}
      </div>
      <div className="flex gap-[2px] mt-1.5">
        {MESES.map((m) => <span key={m} className="flex-1 text-center text-[10px] text-muted-foreground">{m}</span>)}
      </div>
    </div>
  )
}

// ─── Formulário de despesa ────────────────────────────────────────────────────

function DespesaForm({ aberto, onFechar, onSalvo }: { aberto: boolean; onFechar: () => void; onSalvo: () => void }) {
  const { usuario } = useAuth()
  const { equipamentos, prestadores } = useOpcoesManutencao(aberto)
  const hoje = new Date().toISOString().slice(0, 10)
  const vazio = {
    descricao: "", categoria: CATEGORIAS_DESPESA[0] as string, valor: "", competencia: hoje, vencimento: "",
    prestadorId: "", equipamentoId: "", notaFiscal: null as string | null, observacoes: "", situacao: "pendente",
  }
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)
  const aprova = podeAprovar(usuario?.role)

  useEffect(() => { if (aberto) setForm(vazio) }, [aberto]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const salvar = async () => {
    setSalvando(true)
    const res = await fetch("/api/despesas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descricao: form.descricao, categoria: form.categoria,
        valor: parseFloat(form.valor.replace(/\./g, "").replace(",", ".")),
        competencia: form.competencia, vencimento: form.vencimento || null,
        prestadorId: form.prestadorId || null, equipamentoId: form.equipamentoId || null,
        notaFiscal: form.notaFiscal, observacoes: form.observacoes || null,
        jaAprovada: form.situacao !== "pendente", jaPaga: form.situacao === "paga",
      }),
    })
    const data = await res.json()
    setSalvando(false)
    if (!res.ok) { toast.error(data.message ?? "Erro ao lançar"); return }
    toast.success(data.status === "PENDENTE_APROVACAO" ? "Despesa enviada para aprovação" : "Despesa lançada")
    onSalvo(); onFechar()
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Lançar despesa</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5"><Label>Descrição *</Label><Input value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Ex: Troca de lâmpadas da garagem" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <NativeSelect value={form.categoria} onChange={(e) => set("categoria", e.target.value)}>
                {CATEGORIAS_DESPESA.map((c) => <option key={c}>{c}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5"><Label>Valor (R$) *</Label><Input inputMode="decimal" value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Competência</Label><Input type="date" value={form.competencia} onChange={(e) => set("competencia", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Vencimento</Label><Input type="date" value={form.vencimento} onChange={(e) => set("vencimento", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <NativeSelect value={form.prestadorId} onChange={(e) => set("prestadorId", e.target.value)}>
                <option value="">—</option>
                {prestadores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label>Equipamento</Label>
              <NativeSelect value={form.equipamentoId} onChange={(e) => set("equipamentoId", e.target.value)}>
                <option value="">—</option>
                {equipamentos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Nota fiscal / orçamento</Label><ArquivoUnicoInput valor={form.notaFiscal} onChange={(v) => set("notaFiscal", v)} pasta="despesas" /></div>
          {aprova && (
            <div className="space-y-1.5">
              <Label>Situação</Label>
              <Pilulas
                valor={form.situacao}
                onChange={(v) => set("situacao", v)}
                opcoes={[{ valor: "pendente", rotulo: "Enviar p/ aprovação" }, { valor: "aprovada", rotulo: "Já aprovada" }, { valor: "paga", rotulo: "Já paga" }]}
              />
            </div>
          )}
          <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={2} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || form.descricao.trim().length < 2 || !form.valor}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Lançar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Editor de orçamento ──────────────────────────────────────────────────────

function OrcamentoEditor({ ano, relatorio, onSalvo, podeEditar }: { ano: number; relatorio: Relatorio | null; onSalvo: () => void; podeEditar: boolean }) {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const v: Record<string, string> = {}
    for (const c of CATEGORIAS_DESPESA) v[c] = ""
    for (const l of relatorio?.linhas ?? []) if (l.orcadoMensal) v[l.categoria] = String(l.orcadoMensal).replace(".", ",")
    setValores(v)
  }, [relatorio])

  const salvar = async () => {
    setSalvando(true)
    const itens = Object.entries(valores)
      .map(([categoria, v]) => ({ categoria, valorMensal: parseFloat((v || "0").replace(/\./g, "").replace(",", ".")) || 0 }))
      .filter((i) => i.valorMensal > 0)
    const res = await fetch("/api/financeiro", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ano, itens }) })
    setSalvando(false)
    if (res.ok) { toast.success("Orçamento salvo"); onSalvo() } else toast.error("Erro ao salvar")
  }

  const total = Object.values(valores).reduce((t, v) => t + (parseFloat((v || "0").replace(/\./g, "").replace(",", ".")) || 0), 0)
  const realizadoDe = (c: string) => relatorio?.linhas.find((l) => l.categoria === c)?.realizado ?? 0

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border">
              <th className="text-left font-medium px-4 py-2">Categoria</th>
              <th className="text-right font-medium px-4 py-2">Orçado / mês</th>
              <th className="text-right font-medium px-4 py-2">Orçado no ano</th>
              <th className="text-right font-medium px-4 py-2">Realizado no ano</th>
              <th className="text-right font-medium px-4 py-2">% usado</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIAS_DESPESA.map((c) => {
              const mensal = parseFloat((valores[c] || "0").replace(/\./g, "").replace(",", ".")) || 0
              const real = realizadoDe(c)
              const pct = mensal ? Math.round((real / (mensal * 12)) * 100) : null
              return (
                <tr key={c} className="border-b border-border last:border-0">
                  <td className="px-4 py-1.5">{c}</td>
                  <td className="px-4 py-1.5 text-right">
                    {podeEditar ? (
                      <Input className="h-7 w-32 ml-auto text-right" inputMode="decimal" value={valores[c] ?? ""} onChange={(e) => setValores({ ...valores, [c]: e.target.value })} placeholder="0,00" />
                    ) : formatMoeda(mensal)}
                  </td>
                  <td className="px-4 py-1.5 text-right text-muted-foreground">{mensal ? formatMoeda(mensal * 12) : "—"}</td>
                  <td className="px-4 py-1.5 text-right">{real ? formatMoeda(real) : "—"}</td>
                  <td className={cn("px-4 py-1.5 text-right font-medium", pct !== null && pct > 100 ? "text-red-600" : "text-muted-foreground")}>
                    {pct !== null ? `${pct}%` : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right">{formatMoeda(total)}</td>
              <td className="px-4 py-2 text-right">{formatMoeda(total * 12)}</td>
              <td className="px-4 py-2 text-right">{formatMoeda(relatorio?.realizadoAnoTotal ?? 0)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {podeEditar && (
        <div className="flex justify-end">
          <Button size="sm" onClick={salvar} disabled={salvando}>{salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar orçamento de {ano}</Button>
        </div>
      )}
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

function Conteudo() {
  const { usuario } = useAuth()
  const gestor = podeGerenciar(usuario?.role)
  const aprova = podeAprovar(usuario?.role)
  const anoAtual = new Date().getFullYear()
  const [aba, setAba] = useState<Aba>("despesas")
  const [ano, setAno] = useState(anoAtual)
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1)
  const [status, setStatus] = useState("")
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [totais, setTotais] = useState({ realizado: 0, pago: 0, aPagar: 0, aguardandoAprovacao: 0 })
  const [pendentes, setPendentes] = useState(0)
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({ ano: String(ano), ...(mes ? { mes: String(mes) } : {}), ...(status ? { status } : {}) })
    const [d, r] = await Promise.all([fetch(`/api/despesas?${qs}`), fetch(`/api/financeiro?ano=${ano}`)])
    if (d.ok) { const j = await d.json(); setDespesas(j.despesas); setTotais(j.totais); setPendentes(j.pendentesAprovacao) }
    if (r.ok) setRelatorio(await r.json())
    setLoading(false)
  }, [ano, mes, status])

  useEffect(() => { carregar() }, [carregar])

  const acao = async (d: Despesa, acaoNome: "aprovar" | "reprovar" | "pagar" | "estornar") => {
    const res = await fetch(`/api/despesas/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: acaoNome }) })
    const data = await res.json()
    if (!res.ok) { toast.error(data.message ?? "Erro"); return }
    toast.success({ aprovar: "Despesa aprovada", reprovar: "Despesa reprovada", pagar: "Pagamento registrado", estornar: "Pagamento desfeito" }[acaoNome])
    carregar()
  }

  const excluir = async (d: Despesa) => {
    if (!confirm(`Excluir "${d.descricao}"?`)) return
    const res = await fetch(`/api/despesas/${d.id}`, { method: "DELETE" })
    if (res.ok) { toast.success("Excluída"); carregar() }
  }

  const orcadoMes = relatorio?.orcadoMensalTotal ?? 0
  const realizadoMes = mes && relatorio ? relatorio.totalMes[mes - 1] : totais.realizado
  const desvio = orcadoMes ? realizadoMes - orcadoMes : 0
  const anos = useMemo(() => [anoAtual + 1, anoAtual, anoAtual - 1, anoAtual - 2], [anoAtual])

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Financeiro operacional"
        descricao="Despesas, aprovação de compras, orçado × realizado e custos por equipamento e fornecedor."
        acoes={
          <>
            {aba === "relatorio" && <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>}
            {gestor && <Button size="sm" onClick={() => setForm(true)}><Plus className="h-4 w-4 mr-2" />Lançar despesa</Button>}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Pilulas<Aba> valor={aba} onChange={setAba} opcoes={[
          { valor: "despesas", rotulo: "Despesas", contagem: pendentes || undefined },
          { valor: "orcamento", rotulo: "Orçado × realizado" },
          { valor: "relatorio", rotulo: "Relatório anual" },
        ]} />
        <NativeSelect className="w-24 h-8" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </NativeSelect>
        {aba === "despesas" && (
          <>
            <NativeSelect className="w-32 h-8" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              <option value={0}>Ano inteiro</option>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </NativeSelect>
            <NativeSelect className="w-48 h-8" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_DESPESA).map(([v, s]) => <option key={v} value={v}>{s.rotulo}</option>)}
            </NativeSelect>
          </>
        )}
      </div>

      {aba === "despesas" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icone={Receipt} rotulo={mes ? `Realizado em ${MESES[mes - 1]}` : `Realizado em ${ano}`} valor={formatMoeda(realizadoMes)}
              detalhe={orcadoMes && mes ? `${desvio > 0 ? "▲" : "▼"} ${formatMoeda(Math.abs(desvio))} ${desvio > 0 ? "acima" : "abaixo"} do orçado` : undefined}
              tom={orcadoMes && mes && desvio > 0 ? "perigo" : "padrao"} />
            <StatCard icone={Banknote} rotulo="A pagar (aprovadas)" valor={formatMoeda(totais.aPagar)} />
            <StatCard icone={CheckCircle2} rotulo="Pago" valor={formatMoeda(totais.pago)} tom="ok" />
            <StatCard icone={Clock} rotulo="Aguardando aprovação" valor={pendentes} detalhe={formatMoeda(totais.aguardandoAprovacao)} tom={pendentes ? "alerta" : "padrao"} />
          </div>

          {relatorio && <GraficoMensal totalMes={relatorio.totalMes} orcado={orcadoMes} />}

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
          ) : despesas.length === 0 ? (
            <EstadoVazio icone={Wallet} titulo="Nenhuma despesa no período" descricao="Lance as despesas operacionais. Orçamentos de manutenção aprovados entram aqui automaticamente." />
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {despesas.map((d) => {
                const st = STATUS_DESPESA[d.status]
                return (
                  <div key={d.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-48">
                      <p className="text-sm font-medium">{d.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.categoria} · {formatDate(d.competencia)}
                        {d.prestador && ` · ${d.prestador.nome}`}
                        {d.equipamento && ` · ${d.equipamento.nome}`}
                        {d.manutencao && " · via manutenção"}
                      </p>
                      {d.aprovadoPor && <p className="text-[11px] text-muted-foreground">{d.status === "REPROVADA" ? "Reprovada" : "Aprovada"} por {d.aprovadoPor}</p>}
                    </div>
                    <span className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5", st.cor)}>{st.rotulo}</span>
                    <span className="text-sm font-semibold w-28 text-right">{formatMoeda(d.valor)}</span>
                    {(d.notaFiscal || d.comprovante) && (
                      <a href={urlArquivo(d.notaFiscal ?? d.comprovante)} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" title="Ver anexo"><Paperclip className="h-4 w-4" /></a>
                    )}
                    {aprova && d.status === "PENDENTE_APROVACAO" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7" onClick={() => acao(d, "aprovar")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Aprovar</Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => acao(d, "reprovar")}><XCircle className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                    {gestor && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {d.status === "APROVADA" && <DropdownMenuItem onClick={() => acao(d, "pagar")}><Banknote className="h-4 w-4 mr-2" />Marcar como paga</DropdownMenuItem>}
                          {d.status === "PAGA" && <DropdownMenuItem onClick={() => acao(d, "estornar")}><Undo2 className="h-4 w-4 mr-2" />Desfazer pagamento</DropdownMenuItem>}
                          <DropdownMenuItem onClick={() => excluir(d)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {aba === "orcamento" && <OrcamentoEditor ano={ano} relatorio={relatorio} onSalvo={carregar} podeEditar={gestor} />}

      {aba === "relatorio" && relatorio && (
        <div className="space-y-6">
          <div className="hidden print:block">
            <h2 className="text-xl font-semibold">{usuario?.condominio.nome} — Relatório de despesas {ano}</h2>
            <p className="text-sm text-muted-foreground">Gerado em {new Date().toLocaleDateString("pt-BR")} pelo ZeloH</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard icone={Wallet} rotulo={`Orçado ${ano}`} valor={moedaCurta(relatorio.orcadoAnoTotal)} />
            <StatCard icone={Receipt} rotulo={`Realizado ${ano}`} valor={moedaCurta(relatorio.realizadoAnoTotal)} />
            <StatCard icone={TrendingUp} rotulo="Execução do orçamento"
              valor={relatorio.orcadoAnoTotal ? `${Math.round((relatorio.realizadoAnoTotal / relatorio.orcadoAnoTotal) * 100)}%` : "—"}
              tom={relatorio.orcadoAnoTotal && relatorio.realizadoAnoTotal > relatorio.orcadoAnoTotal ? "perigo" : "padrao"} />
          </div>
          <GraficoMensal totalMes={relatorio.totalMes} orcado={relatorio.orcadoMensalTotal} />
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-3 py-2 sticky left-0 bg-card">Categoria</th>
                  {MESES.map((m) => <th key={m} className="text-right font-medium px-2 py-2">{m}</th>)}
                  <th className="text-right font-medium px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {relatorio.linhas.filter((l) => l.realizado > 0).map((l) => (
                  <tr key={l.categoria} className="border-b border-border">
                    <td className="px-3 py-1.5 sticky left-0 bg-card whitespace-nowrap">{l.categoria}</td>
                    {l.realizadoMes.map((v, i) => <td key={i} className="px-2 py-1.5 text-right text-muted-foreground">{v ? Math.round(v).toLocaleString("pt-BR") : "—"}</td>)}
                    <td className="px-3 py-1.5 text-right font-medium">{formatMoeda(l.realizado)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="px-3 py-2 sticky left-0 bg-card">Total</td>
                  {relatorio.totalMes.map((v, i) => <td key={i} className="px-2 py-2 text-right">{v ? Math.round(v).toLocaleString("pt-BR") : "—"}</td>)}
                  <td className="px-3 py-2 text-right">{formatMoeda(relatorio.realizadoAnoTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {([["Custo por equipamento", relatorio.porEquipamento], ["Gasto por fornecedor", relatorio.porPrestador]] as const).map(([titulo, lista]) => (
              <div key={titulo} className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-medium mb-3">{titulo}</p>
                {lista.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados no período.</p> : (
                  <div className="space-y-2">
                    {lista.map((i) => (
                      <div key={i.id}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="truncate">{i.nome} <span className="text-muted-foreground">({i.quantidade})</span></span>
                          <span className="font-medium">{formatMoeda(i.total)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(i.total / lista[0].total) * 100}%`, background: "#B84A2E" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <DespesaForm aberto={form} onFechar={() => setForm(false)} onSalvo={carregar} />
    </div>
  )
}

export default function FinanceiroPage() {
  return <ModuloGate modulo="financeiro"><Conteudo /></ModuloGate>
}

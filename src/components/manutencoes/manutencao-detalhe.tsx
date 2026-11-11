"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Calendar, CheckCircle2, Cog, FileDown, Loader2, MapPin, Pencil, Play, Star, Trash2, User,
  AlertTriangle, Receipt, RotateCcw, Repeat,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArquivosInput, ArquivoUnicoInput, GaleriaArquivos } from "@/components/shared/arquivos-input"
import { useAuth } from "@/hooks/use-auth"
import { podeAprovar, podeGerenciar, podeOperar } from "@/lib/permissions"
import { cn, formatDate, formatMoeda } from "@/lib/utils"
import { STATUS_CONFIG, PRIORIDADE_CONFIG, TIPO_CONFIG, estaAtrasada, type Manutencao, type ItemChecklist } from "./tipos"

function Secao({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</p>
        {acao}
      </div>
      {children}
    </div>
  )
}

export function ManutencaoDetalhe({
  manutencao: m,
  onFechar,
  onAtualizado,
  onEditar,
  onExcluido,
}: {
  manutencao: Manutencao | null
  onFechar: () => void
  onAtualizado: (m: Manutencao) => void
  onEditar?: (m: Manutencao) => void
  onExcluido?: (id: string) => void
}) {
  const { usuario } = useAuth()
  const role = usuario?.role
  const [salvando, setSalvando] = useState<string | null>(null)
  const [orcValor, setOrcValor] = useState("")
  const [orcArquivo, setOrcArquivo] = useState<string | null>(null)
  const [orcObs, setOrcObs] = useState("")
  const [decisaoObs, setDecisaoObs] = useState("")
  const [nota, setNota] = useState(0)
  const [comentario, setComentario] = useState("")

  if (!m) return null

  const gestor = podeGerenciar(role)
  const executa = gestor || role === "ZELADOR" || (role === "PRESTADOR" && usuario?.prestadorId === m.prestadorId)
  const aprova = podeAprovar(role)
  const atrasada = estaAtrasada(m)
  const st = STATUS_CONFIG[m.status] ?? { label: m.status, color: "bg-muted text-muted-foreground border-border", icon: null }
  const pr = m.prioridade ? PRIORIDADE_CONFIG[m.prioridade] : null
  const checklist: ItemChecklist[] = Array.isArray(m.checklist) ? m.checklist : []
  const feitos = checklist.filter((c) => c.feito).length
  const avaliacao = m.avaliacoes?.[0]

  const patch = async (corpo: Record<string, unknown>, chave: string, msg?: string) => {
    setSalvando(chave)
    try {
      const res = await fetch(`/api/manutencoes/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message ?? "Erro ao salvar"); return false }
      onAtualizado(data)
      if (msg) toast.success(msg)
      return true
    } finally {
      setSalvando(null)
    }
  }

  const recarregar = async () => {
    const res = await fetch(`/api/manutencoes/${m.id}`)
    if (res.ok) onAtualizado(await res.json())
  }

  const orcamento = async (corpo: Record<string, unknown>, msg: string) => {
    setSalvando("orcamento")
    try {
      const res = await fetch(`/api/manutencoes/${m.id}/orcamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message ?? "Erro"); return }
      toast.success(msg)
      setOrcValor(""); setOrcArquivo(null); setOrcObs(""); setDecisaoObs("")
      await recarregar()
    } finally {
      setSalvando(null)
    }
  }

  const avaliar = async () => {
    setSalvando("avaliacao")
    try {
      const res = await fetch(`/api/manutencoes/${m.id}/avaliacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota, comentario: comentario || null }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message ?? "Erro"); return }
      toast.success("Avaliação registrada")
      await recarregar()
    } finally {
      setSalvando(null)
    }
  }

  const excluir = async () => {
    if (!confirm(`Excluir a manutenção "${m.titulo}"? Esta ação não pode ser desfeita.`)) return
    const res = await fetch(`/api/manutencoes/${m.id}`, { method: "DELETE" })
    const data = await res.json()
    if (!res.ok) { toast.error(data.message ?? "Erro ao excluir"); return }
    toast.success("Manutenção excluída")
    onExcluido?.(m.id)
    onFechar()
  }

  const toggleItem = (i: number) => {
    const novo = checklist.map((c, idx) => (idx === i ? { ...c, feito: !c.feito } : c))
    patch({ checklist: novo }, `check-${i}`)
  }

  return (
    <Dialog open={!!m} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5 pr-6">
            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", TIPO_CONFIG[m.tipo].color)}>
              {TIPO_CONFIG[m.tipo].label}
            </span>
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", st.color)}>
              {st.icon}{st.label}
            </span>
            {pr && <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium", pr.color)}>{pr.label}</span>}
            {atrasada && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                <AlertTriangle className="h-3 w-3" /> Atrasada
              </span>
            )}
            {m.visttoOsCod && <span className="text-[10px] font-mono text-muted-foreground">VISTTO #{m.visttoOsCod}</span>}
          </div>
          <DialogTitle className="text-left pt-1">{m.titulo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Informações */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {m.equipamento && (
              <Link href={`/equipamentos/${m.equipamento.id}`} className="flex items-center gap-2 text-primary hover:underline col-span-2">
                <Cog className="h-4 w-4 shrink-0" /> {m.equipamento.nome}
              </Link>
            )}
            {(m.prestador?.nome || m.prestadorNome || m.empresaNome) && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4 shrink-0" />
                <span className="truncate">{m.prestador?.nome ?? m.empresaNome ?? m.prestadorNome}</span>
              </p>
            )}
            {m.agendadoEm && (
              <p className={cn("flex items-center gap-2", atrasada ? "text-red-600 font-medium" : "text-muted-foreground")}>
                <Calendar className="h-4 w-4 shrink-0" /> {formatDate(m.agendadoEm)}
              </p>
            )}
            {m.local && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" /> <span className="truncate">{m.local}</span>
              </p>
            )}
            {m.valor != null && (
              <p className="flex items-center gap-2 font-medium">
                <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" /> {formatMoeda(m.valor)}
              </p>
            )}
            {m.plano && (
              <p className="flex items-center gap-2 text-muted-foreground col-span-2">
                <Repeat className="h-4 w-4 shrink-0" /> Plano preventivo: {m.plano.titulo} (a cada {m.plano.intervaloDias} dias)
              </p>
            )}
            {m.concluidoEm && (
              <p className="flex items-center gap-2 text-green-700 col-span-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> Concluída em {formatDate(m.concluidoEm)}
              </p>
            )}
            {m.chamado && (
              <p className="text-xs text-muted-foreground col-span-2">Originada da ocorrência: {m.chamado.titulo}</p>
            )}
          </div>

          {m.descricao && <p className="text-sm whitespace-pre-wrap">{m.descricao}</p>}

          {/* Ações de execução */}
          {executa && m.status !== "COMPLETED" && m.status !== "CANCELLED" && (
            <div className="flex flex-wrap gap-2">
              {m.status !== "IN_PROGRESS" && (
                <Button variant="outline" size="sm" disabled={!!salvando} onClick={() => patch({ status: "IN_PROGRESS" }, "status", "Serviço iniciado")}>
                  <Play className="h-4 w-4 mr-1.5" /> Iniciar
                </Button>
              )}
              <Button
                size="sm"
                disabled={!!salvando}
                onClick={() => {
                  if (checklist.length && feitos < checklist.length &&
                      !confirm(`Ainda há ${checklist.length - feitos} item(ns) do checklist pendente(s). Concluir mesmo assim?`)) return
                  patch({ status: "COMPLETED" }, "status", "Manutenção concluída")
                }}
              >
                {salvando === "status" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                Concluir
              </Button>
            </div>
          )}
          {gestor && m.status === "COMPLETED" && (
            <Button variant="ghost" size="sm" onClick={() => patch({ status: "IN_PROGRESS" }, "status", "Manutenção reaberta")}>
              <RotateCcw className="h-4 w-4 mr-1.5" /> Reabrir
            </Button>
          )}

          {/* Checklist */}
          {checklist.length > 0 && (
            <Secao titulo={`Checklist · ${feitos}/${checklist.length}`}>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${(feitos / checklist.length) * 100}%` }} />
              </div>
              <div className="space-y-1">
                {checklist.map((c, i) => (
                  <label key={i} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm", executa && "hover:bg-accent/40 cursor-pointer")}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#B84A2E]"
                      checked={c.feito}
                      disabled={!executa || !!salvando}
                      onChange={() => toggleItem(i)}
                    />
                    <span className={cn(c.feito && "line-through text-muted-foreground")}>{c.item}</span>
                    {salvando === `check-${i}` && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
                  </label>
                ))}
              </div>
            </Secao>
          )}

          {/* Evidências */}
          <Secao titulo="Fotos e evidências">
            {executa ? (
              <ArquivosInput
                valor={m.fotos ?? []}
                onChange={(fotos) => patch({ fotos }, "fotos")}
                pasta="manutencoes"
                max={12}
                rotulo="Adicionar foto"
              />
            ) : (m.fotos?.length ?? 0) > 0 ? (
              <GaleriaArquivos arquivos={m.fotos} />
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma foto.</p>
            )}
            {(executa || m.anexos?.length > 0) && (
              <div className="pt-1">
                <p className="text-xs text-muted-foreground mb-1">Laudos, notas e documentos</p>
                {executa ? (
                  <ArquivosInput valor={m.anexos ?? []} onChange={(anexos) => patch({ anexos }, "anexos")} pasta="manutencoes" max={8} aceitarPdf rotulo="Anexar documento" />
                ) : (
                  <GaleriaArquivos arquivos={m.anexos} tamanho="sm" />
                )}
              </div>
            )}
          </Secao>

          {/* Orçamento */}
          <Secao titulo="Orçamento">
            {m.orcamentoStatus === "PENDENTE" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-sm font-medium text-amber-900">
                  Aguardando aprovação: {formatMoeda(m.orcamentoValor)}
                </p>
                {m.orcamentoObs && <p className="text-xs text-amber-900/80">{m.orcamentoObs}</p>}
                {m.orcamentoArquivo && <GaleriaArquivos arquivos={[m.orcamentoArquivo]} tamanho="sm" />}
                {aprova && (
                  <div className="space-y-2 pt-1">
                    <Input placeholder="Observação (opcional)" value={decisaoObs} onChange={(e) => setDecisaoObs(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={salvando === "orcamento"} onClick={() => orcamento({ acao: "aprovar", obs: decisaoObs || null }, "Orçamento aprovado e lançado no financeiro")}>
                        Aprovar
                      </Button>
                      <Button size="sm" variant="outline" disabled={salvando === "orcamento"} onClick={() => orcamento({ acao: "reprovar", obs: decisaoObs || null }, "Orçamento reprovado")}>
                        Reprovar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {(m.orcamentoStatus === "APROVADO" || m.orcamentoStatus === "REPROVADO") && (
              <div className={cn("rounded-lg border p-3 text-sm", m.orcamentoStatus === "APROVADO" ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900")}>
                {m.orcamentoStatus === "APROVADO" ? "Aprovado" : "Reprovado"}: {formatMoeda(m.orcamentoValor)}
                {m.orcamentoDecididoPor && <> · por {m.orcamentoDecididoPor}{m.orcamentoDecididoEm && ` em ${formatDate(m.orcamentoDecididoEm)}`}</>}
                {m.orcamentoObs && <p className="text-xs mt-1 opacity-80">{m.orcamentoObs}</p>}
                {m.orcamentoArquivo && <div className="mt-2"><GaleriaArquivos arquivos={[m.orcamentoArquivo]} tamanho="sm" /></div>}
              </div>
            )}
            {m.orcamentoStatus !== "PENDENTE" && m.status !== "COMPLETED" && (podeOperar(role) || (role === "PRESTADOR" && executa)) && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {m.orcamentoStatus === "REPROVADO" ? "Enviar novo orçamento" : "Enviar orçamento para aprovação do síndico/conselho"}
                </p>
                <Input inputMode="decimal" placeholder="Valor (R$)" value={orcValor} onChange={(e) => setOrcValor(e.target.value)} />
                <ArquivoUnicoInput valor={orcArquivo} onChange={setOrcArquivo} pasta="orcamentos" rotulo="Anexar orçamento (PDF ou foto)" />
                <Textarea rows={2} placeholder="Observações (prazo, garantia...)" value={orcObs} onChange={(e) => setOrcObs(e.target.value)} />
                <Button
                  size="sm"
                  disabled={salvando === "orcamento" || !orcValor}
                  onClick={() => orcamento(
                    { acao: "solicitar", valor: parseFloat(orcValor.replace(/\./g, "").replace(",", ".")), arquivo: orcArquivo, obs: orcObs || null },
                    "Orçamento enviado para aprovação"
                  )}
                >
                  Enviar para aprovação
                </Button>
              </div>
            )}
            {m.orcamentoStatus === "NAO_SE_APLICA" && !podeOperar(role) && role !== "PRESTADOR" && (
              <p className="text-sm text-muted-foreground">Sem orçamento.</p>
            )}
          </Secao>

          {/* Avaliação do prestador */}
          {m.status === "COMPLETED" && m.prestadorId && (aprova || avaliacao) && (
            <Secao titulo="Avaliação do prestador">
              {avaliacao && (
                <div className="flex items-center gap-1 text-sm">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={cn("h-4 w-4", i < avaliacao.nota ? "fill-amber-400 text-amber-400" : "text-muted")} />
                  ))}
                  {avaliacao.comentario && <span className="ml-2 text-muted-foreground">{avaliacao.comentario}</span>}
                </div>
              )}
              {aprova && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button key={i} type="button" onClick={() => setNota(i + 1)} aria-label={`${i + 1} estrelas`}>
                        <Star className={cn("h-6 w-6 transition-colors", i < nota ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-300")} />
                      </button>
                    ))}
                  </div>
                  {nota > 0 && (
                    <>
                      <Input placeholder="Comentário (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
                      <Button size="sm" variant="outline" disabled={salvando === "avaliacao"} onClick={avaliar}>
                        {avaliacao ? "Atualizar avaliação" : "Salvar avaliação"}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Secao>
          )}

          {m.observacoes && (
            <Secao titulo="Observações">
              <p className="text-sm bg-muted/50 rounded-lg px-3 py-2 whitespace-pre-wrap">{m.observacoes}</p>
            </Secao>
          )}

          {/* Rodapé */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {gestor && onEditar && (
              <Button variant="outline" size="sm" onClick={() => onEditar(m)}>
                <Pencil className="h-4 w-4 mr-1.5" /> Editar
              </Button>
            )}
            {m.visttoOsId && (
              <a href={`/api/vistto/pdf/${m.visttoOsId}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm"><FileDown className="h-4 w-4 mr-1.5" /> PDF da OS</Button>
              </a>
            )}
            {gestor && !m.visttoOsId && (
              <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground hover:text-destructive" onClick={excluir}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

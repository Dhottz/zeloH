"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, Cog, Loader2, MoreHorizontal, Pause, Pencil, Play, Plus, Repeat, Trash2, User } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea, NativeSelect } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EstadoVazio } from "@/components/shared/page-header"
import { useAuth } from "@/hooks/use-auth"
import { podeGerenciar } from "@/lib/permissions"
import { cn, formatDate, paraInputData, diasAte } from "@/lib/utils"
import { useOpcoesManutencao } from "./tipos"

const PERIODICIDADES = [
  { dias: 7, rotulo: "Semanal" }, { dias: 15, rotulo: "Quinzenal" }, { dias: 30, rotulo: "Mensal" },
  { dias: 60, rotulo: "Bimestral" }, { dias: 90, rotulo: "Trimestral" }, { dias: 180, rotulo: "Semestral" },
  { dias: 365, rotulo: "Anual" },
]

function rotuloPeriodo(dias: number) {
  return PERIODICIDADES.find((p) => p.dias === dias)?.rotulo ?? `A cada ${dias} dias`
}

/** Sugestões prontas para o síndico começar rápido. */
const MODELOS = [
  { titulo: "Manutenção mensal do elevador", intervaloDias: 30, checklist: "Inspeção de cabos e polias\nTeste de freio\nLimpeza do poço\nRegistro no livro de ocorrências" },
  { titulo: "Limpeza dos reservatórios", intervaloDias: 180, checklist: "Esvaziamento e escovação\nDesinfecção com cloro\nEmissão do certificado de limpeza" },
  { titulo: "Revisão das bombas de recalque", intervaloDias: 90, checklist: "Medir corrente do motor\nVerificar vazamentos no selo\nTestar automático de boia\nLubrificar rolamentos" },
  { titulo: "Recarga e inspeção de extintores", intervaloDias: 365, checklist: "Verificar validade e lacre\nRecarregar vencidos\nConferir sinalização" },
  { titulo: "Lubrificação do portão", intervaloDias: 60, checklist: "Lubrificar trilho e cremalheira\nTestar fim de curso\nVerificar sensor anti-esmagamento" },
]

export interface Plano {
  id: string
  titulo: string
  descricao: string | null
  intervaloDias: number
  proximaEm: string
  antecedenciaDias: number
  checklist: string[]
  ativo: boolean
  equipamentoId: string | null
  prestadorId: string | null
  equipamento: { id: string; nome: string } | null
  prestador: { id: string; nome: string } | null
  _count?: { manutencoes: number }
}

const vazio = {
  titulo: "", descricao: "", intervaloDias: 30, intervaloCustom: "", proximaEm: "", antecedenciaDias: 7,
  checklistTexto: "", equipamentoId: "", prestadorId: "",
}

export function PlanoForm({
  aberto, onFechar, onSalvo, editando, equipamentoIdPadrao,
}: {
  aberto: boolean
  onFechar: () => void
  onSalvo: () => void
  editando?: Plano | null
  equipamentoIdPadrao?: string
}) {
  const { equipamentos, prestadores } = useOpcoesManutencao(aberto)
  const [form, setForm] = useState({ ...vazio })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    if (editando) {
      const conhecido = PERIODICIDADES.some((p) => p.dias === editando.intervaloDias)
      setForm({
        titulo: editando.titulo,
        descricao: editando.descricao ?? "",
        intervaloDias: conhecido ? editando.intervaloDias : 0,
        intervaloCustom: conhecido ? "" : String(editando.intervaloDias),
        proximaEm: paraInputData(editando.proximaEm),
        antecedenciaDias: editando.antecedenciaDias,
        checklistTexto: editando.checklist.join("\n"),
        equipamentoId: editando.equipamentoId ?? "",
        prestadorId: editando.prestadorId ?? "",
      })
    } else {
      setForm({ ...vazio, equipamentoId: equipamentoIdPadrao ?? "" })
    }
  }, [aberto, editando, equipamentoIdPadrao])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const intervalo = form.intervaloDias || parseInt(form.intervaloCustom) || 0

  const salvar = async () => {
    setSalvando(true)
    try {
      const res = await fetch(editando ? `/api/planos/${editando.id}` : "/api/planos", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: form.titulo,
          descricao: form.descricao || null,
          intervaloDias: intervalo,
          proximaEm: form.proximaEm,
          antecedenciaDias: Number(form.antecedenciaDias),
          checklist: form.checklistTexto.split("\n"),
          equipamentoId: form.equipamentoId || null,
          prestadorId: form.prestadorId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message ?? "Erro ao salvar"); return }
      toast.success(editando ? "Plano atualizado" : data.geradas ? `Plano criado — ${data.geradas} OS já agendada(s)` : "Plano criado")
      onSalvo()
      onFechar()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editando ? "Editar plano preventivo" : "Novo plano preventivo"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          {!editando && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Começar de um modelo</Label>
              <div className="flex flex-wrap gap-1.5">
                {MODELOS.map((m) => (
                  <button
                    key={m.titulo}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, titulo: m.titulo, intervaloDias: m.intervaloDias, checklistTexto: m.checklist }))}
                    className="px-2.5 py-1 rounded-lg text-xs border border-border hover:border-primary hover:text-primary transition-colors"
                  >
                    {m.titulo}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex: Manutenção mensal do elevador" />
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
              <Label>Responsável</Label>
              <NativeSelect value={form.prestadorId} onChange={(e) => set("prestadorId", e.target.value)}>
                <option value="">— Equipe interna —</option>
                {prestadores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </NativeSelect>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Periodicidade</Label>
            <div className="flex flex-wrap gap-1.5">
              {PERIODICIDADES.map((p) => (
                <button
                  key={p.dias}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, intervaloDias: p.dias, intervaloCustom: "" }))}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                    form.intervaloDias === p.dias ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.rotulo}
                </button>
              ))}
              <Input
                className="w-32 h-7 text-xs"
                inputMode="numeric"
                placeholder="Outro (dias)"
                value={form.intervaloCustom}
                onChange={(e) => setForm((f) => ({ ...f, intervaloCustom: e.target.value.replace(/\D/g, ""), intervaloDias: 0 }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Próxima execução *</Label>
              <Input type="date" value={form.proximaEm} onChange={(e) => set("proximaEm", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Gerar OS com antecedência de</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={90} value={form.antecedenciaDias} onChange={(e) => set("antecedenciaDias", Number(e.target.value))} />
                <span className="text-xs text-muted-foreground">dias</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Checklist de execução <span className="text-muted-foreground font-normal text-xs">(um item por linha)</span></Label>
            <Textarea rows={4} value={form.checklistTexto} onChange={(e) => set("checklistTexto", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Instruções</Label>
            <Textarea rows={2} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Procedimentos, normas, contatos..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || form.titulo.trim().length < 3 || !form.proximaEm || intervalo < 1}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Lista de planos preventivos (aba de Manutenções e ficha do equipamento). */
export function PlanosPreventivos({ equipamentoId, compacto = false }: { equipamentoId?: string; compacto?: boolean }) {
  const { usuario } = useAuth()
  const gestor = podeGerenciar(usuario?.role)
  const [planos, setPlanos] = useState<Plano[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<{ aberto: boolean; editando: Plano | null }>({ aberto: false, editando: null })

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/planos${equipamentoId ? `?equipamentoId=${equipamentoId}` : ""}`)
    if (res.ok) setPlanos((await res.json()).planos)
    setLoading(false)
  }, [equipamentoId])

  useEffect(() => { carregar() }, [carregar])

  const alternar = async (p: Plano) => {
    const res = await fetch(`/api/planos/${p.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ativo: !p.ativo }),
    })
    if (res.ok) { toast.success(p.ativo ? "Plano pausado" : "Plano reativado"); carregar() }
  }

  const excluir = async (p: Plano) => {
    if (!confirm(`Excluir o plano "${p.titulo}"? As OS já geradas continuam no histórico.`)) return
    const res = await fetch(`/api/planos/${p.id}`, { method: "DELETE" })
    if (res.ok) { toast.success("Plano excluído"); carregar() }
  }

  return (
    <div className="space-y-3">
      {gestor && (
        <div className={cn("flex", compacto ? "justify-end" : "justify-between items-center")}>
          {!compacto && (
            <p className="text-sm text-muted-foreground">
              O ZeloH cria a ordem de serviço automaticamente antes de cada vencimento.
            </p>
          )}
          <Button size="sm" variant={compacto ? "outline" : "default"} onClick={() => setForm({ aberto: true, editando: null })}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo plano
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : planos.length === 0 ? (
        <EstadoVazio
          icone={Repeat}
          titulo="Nenhum plano preventivo"
          descricao="Cadastre a rotina de manutenção (elevador, bombas, reservatórios...) e o sistema agenda tudo sozinho."
        />
      ) : (
        <div className={cn("grid gap-3", !compacto && "sm:grid-cols-2")}>
          {planos.map((p) => {
            const dias = diasAte(p.proximaEm)
            return (
              <div key={p.id} className={cn("rounded-xl border bg-card p-4 space-y-2", !p.ativo && "opacity-60")}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug">{p.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Repeat className="h-3 w-3" /> {rotuloPeriodo(p.intervaloDias)}
                      {!p.ativo && <span className="ml-1 font-medium">· pausado</span>}
                    </p>
                  </div>
                  {gestor && (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setForm({ aberto: true, editando: p })}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => alternar(p)}>
                          {p.ativo ? <><Pause className="h-4 w-4 mr-2" />Pausar</> : <><Play className="h-4 w-4 mr-2" />Reativar</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => excluir(p)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {p.equipamento && !equipamentoId && (
                    <Link href={`/equipamentos/${p.equipamento.id}`} className="flex items-center gap-1 hover:text-primary">
                      <Cog className="h-3 w-3" />{p.equipamento.nome}
                    </Link>
                  )}
                  <p className="flex items-center gap-1"><User className="h-3 w-3" />{p.prestador?.nome ?? "Equipe interna"}</p>
                  <p className={cn("flex items-center gap-1", dias !== null && dias < 0 && p.ativo && "text-red-600 font-medium")}>
                    <CalendarClock className="h-3 w-3" />Próxima: {formatDate(p.proximaEm)} ({dias === null ? "" : dias === 0 ? "hoje" : dias > 0 ? `em ${dias} dia${dias > 1 ? "s" : ""}` : `há ${-dias} dia${dias < -1 ? "s" : ""}`})
                  </p>
                  {p.checklist.length > 0 && <p>{p.checklist.length} item(ns) no checklist</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <PlanoForm
        aberto={form.aberto}
        editando={form.editando}
        equipamentoIdPadrao={equipamentoId}
        onFechar={() => setForm({ aberto: false, editando: null })}
        onSalvo={carregar}
      />
    </div>
  )
}

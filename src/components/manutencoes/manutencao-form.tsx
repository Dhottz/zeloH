"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea, NativeSelect } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ArquivosInput } from "@/components/shared/arquivos-input"
import { cn, paraInputData } from "@/lib/utils"
import { useOpcoesManutencao, type Manutencao } from "./tipos"

const vazio = {
  titulo: "", descricao: "", status: "OPEN", prioridade: "MEDIUM", tipo: "CORRETIVA" as "CORRETIVA" | "PREVENTIVA",
  equipamentoId: "", prestadorId: "", prestadorNome: "", valor: "", agendadoEm: "", local: "", observacoes: "",
  checklistTexto: "", fotos: [] as string[],
}

/**
 * Criar / editar manutenção.
 * `padrao` permite abrir já com equipamento ou chamado preenchidos (ex.: a partir da ficha do equipamento).
 */
export function ManutencaoForm({
  aberto,
  onFechar,
  onSalvo,
  editando,
  padrao,
}: {
  aberto: boolean
  onFechar: () => void
  onSalvo: (m: Manutencao) => void
  editando?: Manutencao | null
  padrao?: Partial<{ equipamentoId: string; chamadoId: string; titulo: string; descricao: string; tipo: "CORRETIVA" | "PREVENTIVA" }>
}) {
  const { equipamentos, prestadores } = useOpcoesManutencao(aberto)
  const [form, setForm] = useState({ ...vazio })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    if (editando) {
      setForm({
        titulo: editando.titulo,
        descricao: editando.descricao ?? "",
        status: editando.status,
        prioridade: editando.prioridade ?? "MEDIUM",
        tipo: editando.tipo,
        equipamentoId: editando.equipamentoId ?? "",
        prestadorId: editando.prestadorId ?? "",
        prestadorNome: editando.prestadorId ? "" : editando.prestadorNome ?? editando.empresaNome ?? "",
        valor: editando.valor != null ? String(editando.valor) : "",
        agendadoEm: paraInputData(editando.agendadoEm),
        local: editando.local ?? "",
        observacoes: editando.observacoes ?? "",
        checklistTexto: "",
        fotos: editando.fotos ?? [],
      })
    } else {
      setForm({ ...vazio, ...padrao, equipamentoId: padrao?.equipamentoId ?? "" })
    }
  }, [aberto, editando, padrao])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const salvar = async () => {
    setSalvando(true)
    try {
      const corpo: Record<string, unknown> = {
        titulo: form.titulo,
        descricao: form.descricao || null,
        status: form.status,
        prioridade: form.prioridade,
        tipo: form.tipo,
        equipamentoId: form.equipamentoId || null,
        prestadorId: form.prestadorId || null,
        valor: form.valor ? parseFloat(form.valor.replace(/\./g, "").replace(",", ".")) : null,
        agendadoEm: form.agendadoEm || null,
        local: form.local || null,
        observacoes: form.observacoes || null,
        fotos: form.fotos,
      }
      if (!form.prestadorId) {
        corpo.prestadorNome = form.prestadorNome || null
        corpo.empresaNome = form.prestadorNome || null
      }
      if (!editando) {
        corpo.checklist = form.checklistTexto.split("\n").map((l) => l.trim()).filter(Boolean)
        if (padrao?.chamadoId) corpo.chamadoId = padrao.chamadoId
      }

      const res = await fetch(editando ? `/api/manutencoes/${editando.id}` : "/api/manutencoes", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message ?? "Erro ao salvar"); return }
      toast.success(editando ? "Manutenção atualizada" : "Manutenção registrada")
      onSalvo(data)
      onFechar()
    } catch {
      toast.error("Erro de conexão")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar manutenção" : "Registrar manutenção"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-2">
            {(["CORRETIVA", "PREVENTIVA"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set("tipo", t)}
                className={cn(
                  "py-2 rounded-lg text-xs font-medium border transition-colors",
                  form.tipo === t
                    ? t === "PREVENTIVA" ? "border-green-300 bg-green-50 text-green-700" : "border-red-300 bg-red-50 text-red-700"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "PREVENTIVA" ? "Preventiva" : "Corretiva"}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex: Troca do rolamento da bomba 2" />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea rows={3} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Descreva o problema ou o serviço..." />
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
              <Label>Local</Label>
              <Input value={form.local} onChange={(e) => set("local", e.target.value)} placeholder="Casa de máquinas" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Prestador</Label>
            <NativeSelect value={form.prestadorId} onChange={(e) => set("prestadorId", e.target.value)}>
              <option value="">— Outro / não cadastrado —</option>
              {prestadores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </NativeSelect>
            {!form.prestadorId && (
              <Input className="mt-2" value={form.prestadorNome} onChange={(e) => set("prestadorNome", e.target.value)} placeholder="Nome da empresa ou técnico (opcional)" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <NativeSelect value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="OPEN">Aberta</option>
                <option value="PENDING">Agendada</option>
                <option value="IN_PROGRESS">Em andamento</option>
                <option value="COMPLETED">Concluída</option>
                <option value="CANCELLED">Cancelada</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <NativeSelect value={form.prioridade} onChange={(e) => set("prioridade", e.target.value)}>
                <option value="URGENT">Urgente</option>
                <option value="HIGH">Alta</option>
                <option value="MEDIUM">Média</option>
                <option value="LOW">Baixa</option>
              </NativeSelect>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data agendada</Label>
              <Input type="date" value={form.agendadoEm} onChange={(e) => set("agendadoEm", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input inputMode="decimal" value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" />
            </div>
          </div>

          {!editando && (
            <div className="space-y-1.5">
              <Label>Checklist <span className="text-muted-foreground font-normal text-xs">(um item por linha)</span></Label>
              <Textarea rows={3} value={form.checklistTexto} onChange={(e) => set("checklistTexto", e.target.value)} placeholder={"Verificar ruído\nMedir corrente do motor\nLubrificar rolamentos"} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Fotos</Label>
            <ArquivosInput valor={form.fotos} onChange={(v) => set("fotos", v)} pasta="manutencoes" />
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Garantia, contatos, informações extras..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || form.titulo.trim().length < 3}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editando ? "Salvar alterações" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

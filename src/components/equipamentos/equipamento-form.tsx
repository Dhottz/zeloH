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
import { CATEGORIAS_EQUIPAMENTO } from "@/lib/equipamentos"
import { paraInputData } from "@/lib/utils"

export interface EquipamentoBase {
  id: string
  nome: string
  categoria: string
  marca: string | null
  modelo: string | null
  numeroSerie: string | null
  local: string | null
  instaladoEm: string | null
  garantiaAte: string | null
  vidaUtilAnos: number | null
  fotos: string[]
  anexos: string[]
  observacoes: string | null
  ativo: boolean
}

const vazio = {
  nome: "", categoria: "OUTRO", marca: "", modelo: "", numeroSerie: "", local: "",
  instaladoEm: "", garantiaAte: "", vidaUtilAnos: "", fotos: [] as string[], anexos: [] as string[], observacoes: "",
}

export function EquipamentoForm({
  aberto, onFechar, onSalvo, editando,
}: {
  aberto: boolean
  onFechar: () => void
  onSalvo: (e: EquipamentoBase) => void
  editando?: EquipamentoBase | null
}) {
  const [form, setForm] = useState({ ...vazio })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setForm(editando ? {
      nome: editando.nome,
      categoria: editando.categoria,
      marca: editando.marca ?? "",
      modelo: editando.modelo ?? "",
      numeroSerie: editando.numeroSerie ?? "",
      local: editando.local ?? "",
      instaladoEm: paraInputData(editando.instaladoEm),
      garantiaAte: paraInputData(editando.garantiaAte),
      vidaUtilAnos: editando.vidaUtilAnos != null ? String(editando.vidaUtilAnos) : "",
      fotos: editando.fotos,
      anexos: editando.anexos,
      observacoes: editando.observacoes ?? "",
    } : { ...vazio })
  }, [aberto, editando])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const salvar = async () => {
    setSalvando(true)
    try {
      const res = await fetch(editando ? `/api/equipamentos/${editando.id}` : "/api/equipamentos", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          categoria: form.categoria,
          marca: form.marca || null,
          modelo: form.modelo || null,
          numeroSerie: form.numeroSerie || null,
          local: form.local || null,
          instaladoEm: form.instaladoEm || null,
          garantiaAte: form.garantiaAte || null,
          vidaUtilAnos: form.vidaUtilAnos ? parseInt(form.vidaUtilAnos) : null,
          fotos: form.fotos,
          anexos: form.anexos,
          observacoes: form.observacoes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message ?? "Erro ao salvar"); return }
      toast.success(editando ? "Equipamento atualizado" : "Equipamento cadastrado")
      onSalvo(data)
      onFechar()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editando ? "Editar equipamento" : "Novo equipamento"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Elevador social — Torre A" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <NativeSelect value={form.categoria} onChange={(e) => set("categoria", e.target.value)}>
                {CATEGORIAS_EQUIPAMENTO.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label>Localização</Label>
              <Input value={form.local} onChange={(e) => set("local", e.target.value)} placeholder="Casa de máquinas" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Marca</Label>
              <Input value={form.marca} onChange={(e) => set("marca", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Nº de série</Label>
              <Input value={form.numeroSerie} onChange={(e) => set("numeroSerie", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Instalado em</Label>
              <Input type="date" value={form.instaladoEm} onChange={(e) => set("instaladoEm", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Garantia até</Label>
              <Input type="date" value={form.garantiaAte} onChange={(e) => set("garantiaAte", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vida útil (anos)</Label>
              <Input inputMode="numeric" value={form.vidaUtilAnos} onChange={(e) => set("vidaUtilAnos", e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Fotos</Label>
            <ArquivosInput valor={form.fotos} onChange={(v) => set("fotos", v)} pasta="equipamentos" />
          </div>
          <div className="space-y-1.5">
            <Label>Manuais e documentos</Label>
            <ArquivosInput valor={form.anexos} onChange={(v) => set("anexos", v)} pasta="equipamentos" aceitarPdf max={10} rotulo="Anexar manual / nota fiscal" />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || form.nome.trim().length < 2}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

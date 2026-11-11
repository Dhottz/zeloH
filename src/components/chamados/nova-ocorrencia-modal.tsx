"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface Morador { id: string; nome: string; unidade: string | null }

interface NovaOcorrenciaModalProps {
  open: boolean
  onClose: () => void
  onCriado: () => void
  initialValues?: { titulo?: string; prioridade?: string }
}

const prioridades = [
  { value: "BAIXA",   label: "Baixa",   color: "bg-gray-100 text-gray-700" },
  { value: "MEDIA",   label: "Média",   color: "bg-yellow-100 text-yellow-700" },
  { value: "ALTA",    label: "Alta",    color: "bg-orange-100 text-orange-700" },
  { value: "URGENTE", label: "Urgente", color: "bg-red-100 text-red-700" },
]

export function NovaOcorrenciaModal({ open, onClose, onCriado, initialValues }: NovaOcorrenciaModalProps) {
  const [titulo, setTitulo] = useState(initialValues?.titulo ?? "")
  const [descricao, setDescricao] = useState("")
  const [prioridade, setPrioridade] = useState(initialValues?.prioridade ?? "MEDIA")
  const [moradorId, setMoradorId] = useState("")
  const [moradores, setMoradores] = useState<Morador[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setTitulo(initialValues?.titulo ?? "")
      setPrioridade(initialValues?.prioridade ?? "MEDIA")
      fetch("/api/moradores")
        .then((r) => r.json())
        .then((d) => setMoradores(d.moradores ?? []))
        .catch(() => {})
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!moradorId) { setError("Selecione o morador"); return }
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, descricao, prioridade, moradorId }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.message)
      }
      setTitulo(""); setDescricao(""); setPrioridade("MEDIA"); setMoradorId("")
      onCriado()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar ocorrência")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Nova ocorrência</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Título</Label>
            <Input placeholder="Descreva o problema brevemente" value={titulo}
              onChange={(e) => setTitulo(e.target.value)} required className="h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Descrição <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <textarea
              placeholder="Detalhes adicionais..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Morador</Label>
            <select
              value={moradorId}
              onChange={(e) => setMoradorId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Selecionar morador...</option>
              {moradores.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}{m.unidade ? ` · ${m.unidade}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Prioridade</Label>
            <div className="flex gap-2">
              {prioridades.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPrioridade(p.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${p.color} ${
                    prioridade === p.value ? "border-current" : "border-transparent opacity-60"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Criando...</> : "Criar ocorrência"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

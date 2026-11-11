"use client"

import { useCallback, useEffect, useState } from "react"
import { Vote, Plus, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { PageHeader, EstadoVazio } from "@/components/shared/page-header"
import { ModuloGate } from "@/components/shared/modulo-gate"
import { EnqueteCard, type Enquete } from "@/components/enquetes/enquete-card"
import { useAuth } from "@/hooks/use-auth"
import { podeGerenciar } from "@/lib/permissions"

function Conteudo() {
  const { usuario } = useAuth()
  const gestor = podeGerenciar(usuario?.role)
  const [lista, setLista] = useState<Enquete[]>([])
  const [totalMoradores, setTotalMoradores] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ titulo: "", descricao: "", opcoes: ["", ""], multiplaEscolha: false, encerraEm: "", resultadoPublico: true })

  const carregar = useCallback(async () => {
    const res = await fetch("/api/enquetes")
    if (res.ok) {
      const d = await res.json()
      setLista(d.enquetes)
      setTotalMoradores(d.totalMoradores)
    }
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const criar = async () => {
    setSalvando(true)
    const res = await fetch("/api/enquetes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        descricao: form.descricao || null,
        encerraEm: form.encerraEm ? new Date(`${form.encerraEm}T23:59:59`).toISOString() : null,
        opcoes: form.opcoes.map((o) => o.trim()).filter(Boolean),
      }),
    })
    const data = await res.json()
    setSalvando(false)
    if (!res.ok) { toast.error(data.message ?? "Erro ao criar"); return }
    toast.success("Enquete publicada e moradores avisados")
    setModal(false)
    setForm({ titulo: "", descricao: "", opcoes: ["", ""], multiplaEscolha: false, encerraEm: "", resultadoPublico: true })
    carregar()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Enquetes"
        descricao="Consulte os moradores antes de decidir: horários, obras, eventos, prioridades."
        acoes={gestor && <Button size="sm" onClick={() => setModal(true)}><Plus className="h-4 w-4 mr-2" />Nova enquete</Button>}
      />

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-56 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : lista.length === 0 ? (
        <EstadoVazio icone={Vote} titulo="Nenhuma enquete ainda" descricao="Crie uma enquete e os moradores recebem o aviso no app, no celular e por e-mail." />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {lista.map((e) => (
            <EnqueteCard
              key={e.id}
              enquete={e}
              gestor={gestor}
              podeVotar={usuario?.role === "CONSELHO" || usuario?.role === "SINDICO" || usuario?.role === "SUBSINDICO"}
              totalMoradores={totalMoradores}
              onAtualizado={carregar}
            />
          ))}
        </div>
      )}

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova enquete</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Pergunta *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Qual o melhor horário para a limpeza da piscina?" />
            </div>
            <div className="space-y-1.5">
              <Label>Contexto</Label>
              <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Opções</Label>
              {form.opcoes.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={o} onChange={(e) => setForm({ ...form, opcoes: form.opcoes.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={`Opção ${i + 1}`} />
                  {form.opcoes.length > 2 && (
                    <Button variant="ghost" size="icon" onClick={() => setForm({ ...form, opcoes: form.opcoes.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button>
                  )}
                </div>
              ))}
              {form.opcoes.length < 10 && (
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => setForm({ ...form, opcoes: [...form.opcoes, ""] })}>+ Adicionar opção</button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Encerrar em <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
              <Input type="date" value={form.encerraEm} onChange={(e) => setForm({ ...form, encerraEm: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[#B84A2E]" checked={form.multiplaEscolha} onChange={(e) => setForm({ ...form, multiplaEscolha: e.target.checked })} />
              Permitir mais de uma resposta
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[#B84A2E]" checked={form.resultadoPublico} onChange={(e) => setForm({ ...form, resultadoPublico: e.target.checked })} />
              Moradores veem o resultado depois de votar
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={criar} disabled={salvando || form.titulo.trim().length < 3 || form.opcoes.filter((o) => o.trim()).length < 2}>
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function EnquetesPage() {
  return <ModuloGate modulo="enquetes"><Conteudo /></ModuloGate>
}

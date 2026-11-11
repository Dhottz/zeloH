"use client"

import { useState } from "react"
import { Check, Lock, Loader2, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn, formatDate } from "@/lib/utils"

export interface Enquete {
  id: string
  titulo: string
  descricao: string | null
  opcoes: string[]
  multiplaEscolha: boolean
  encerraEm: string | null
  encerrada: boolean
  resultadoPublico: boolean
  createdAt: string
  totalVotos: number
  meuVoto: number[] | null
  resultado: number[] | null
}

/** Card de enquete: votação (morador) e resultado (todos, quando liberado). */
export function EnqueteCard({
  enquete: e,
  podeVotar,
  gestor,
  totalMoradores,
  onAtualizado,
}: {
  enquete: Enquete
  podeVotar: boolean
  gestor?: boolean
  totalMoradores?: number
  onAtualizado: () => void
}) {
  const [selecao, setSelecao] = useState<number[]>(e.meuVoto ?? [])
  const [enviando, setEnviando] = useState(false)
  const [mudando, setMudando] = useState(false)

  const votando = podeVotar && !e.encerrada && (!e.meuVoto || mudando)
  const total = e.resultado ? e.resultado.reduce((a, b) => Math.max(a, b), 0) : 0
  const somaVotos = e.totalVotos || 1

  const alternar = (i: number) => {
    if (!votando) return
    setSelecao((s) => (e.multiplaEscolha ? (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]) : [i]))
  }

  const votar = async () => {
    setEnviando(true)
    const res = await fetch(`/api/enquetes/${e.id}/votar`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opcoes: selecao }),
    })
    const data = await res.json()
    setEnviando(false)
    if (!res.ok) { toast.error(data.message ?? "Erro ao votar"); return }
    toast.success("Voto registrado")
    setMudando(false)
    onAtualizado()
  }

  const acao = async (tipo: "encerrar" | "reabrir" | "excluir") => {
    if (tipo === "excluir" && !confirm("Excluir esta enquete e todos os votos?")) return
    const res = tipo === "excluir"
      ? await fetch(`/api/enquetes/${e.id}`, { method: "DELETE" })
      : await fetch(`/api/enquetes/${e.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ encerrada: tipo === "encerrar" }) })
    if (res.ok) onAtualizado()
  }

  return (
    <div className={cn("rounded-2xl border bg-card p-4 space-y-3", e.encerrada ? "border-border" : "border-primary/30")}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-snug">{e.titulo}</p>
          {e.descricao && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{e.descricao}</p>}
        </div>
        <span className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0", e.encerrada ? "bg-muted text-muted-foreground" : "bg-green-50 text-green-700")}>
          {e.encerrada ? "Encerrada" : "Aberta"}
        </span>
      </div>

      <div className="space-y-1.5">
        {e.opcoes.map((op, i) => {
          const votos = e.resultado?.[i] ?? 0
          const pct = e.resultado ? Math.round((votos / somaVotos) * 100) : 0
          const marcado = votando ? selecao.includes(i) : e.meuVoto?.includes(i)
          const vencedor = e.resultado && e.encerrada && votos === total && total > 0
          return (
            <button
              key={i}
              type="button"
              disabled={!votando}
              onClick={() => alternar(i)}
              className={cn(
                "relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                votando && "hover:border-primary/60",
                marcado ? "border-primary" : "border-border"
              )}
            >
              {e.resultado && !votando && (
                <span className={cn("absolute inset-y-0 left-0", vencedor ? "bg-primary/20" : "bg-primary/10")} style={{ width: `${pct}%` }} />
              )}
              <span className="relative flex items-center gap-2">
                <span className={cn(
                  "w-4 h-4 shrink-0 border flex items-center justify-center",
                  e.multiplaEscolha ? "rounded" : "rounded-full",
                  marcado ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                )}>
                  {marcado && <Check className="w-3 h-3" />}
                </span>
                <span className="flex-1">{op}</span>
                {e.resultado && !votando && <span className="text-xs font-medium text-muted-foreground">{pct}% · {votos}</span>}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />{e.totalVotos} voto{e.totalVotos === 1 ? "" : "s"}
          {totalMoradores ? ` de ${totalMoradores} moradores` : ""}
        </span>
        {e.encerraEm && <span>{e.encerrada ? "Encerrou" : "Encerra"} em {formatDate(e.encerraEm)}</span>}
        {e.multiplaEscolha && <span>Múltipla escolha</span>}
        {!e.resultado && podeVotar && <span className="flex items-center gap-1"><Lock className="w-3 h-3" />Resultado após votar</span>}
      </div>

      {votando && (
        <div className="flex gap-2">
          <Button size="sm" className="rounded-xl" disabled={enviando || selecao.length === 0} onClick={votar}>
            {enviando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Votar
          </Button>
          {mudando && <Button size="sm" variant="ghost" onClick={() => { setMudando(false); setSelecao(e.meuVoto ?? []) }}>Cancelar</Button>}
        </div>
      )}
      {podeVotar && e.meuVoto && !e.encerrada && !mudando && (
        <button className="text-xs text-primary hover:underline" onClick={() => setMudando(true)}>Mudar meu voto</button>
      )}

      {gestor && (
        <div className="flex gap-2 border-t border-border pt-2">
          <Button size="sm" variant="ghost" onClick={() => acao(e.encerrada ? "reabrir" : "encerrar")}>
            {e.encerrada ? "Reabrir" : "Encerrar votação"}
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => acao("excluir")}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

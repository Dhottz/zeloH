"use client"

import { useEffect, useState } from "react"
import { Package, Check, Clock } from "lucide-react"
import { urlArquivo } from "@/lib/arquivos"
import { cn } from "@/lib/utils"

interface Encomenda {
  id: string
  remetente: string
  descricao: string | null
  foto: string | null
  retirada: boolean
  retiradaEm: string | null
  retiradoPor: string | null
  createdAt: string
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

export default function MoradorEncomendasPage() {
  const [lista, setLista] = useState<Encomenda[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/entregas")
      .then((r) => (r.ok ? r.json() : { entregas: [] }))
      .then((d) => setLista(d.entregas ?? []))
      .finally(() => setLoading(false))
  }, [])

  const aguardando = lista.filter((e) => !e.retirada)
  const retiradas = lista.filter((e) => e.retirada)

  const Item = ({ e }: { e: Encomenda }) => (
    <div className={cn("rounded-2xl border bg-card p-4 flex gap-3", e.retirada ? "border-border opacity-70" : "border-primary/30")}>
      {e.foto ? (
        <a href={urlArquivo(e.foto)} target="_blank" rel="noreferrer" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urlArquivo(e.foto)} alt="" className="w-16 h-16 rounded-xl object-cover" />
        </a>
      ) : (
        <div className={cn("w-16 h-16 rounded-xl flex items-center justify-center shrink-0", e.retirada ? "bg-green-50" : "bg-primary/10")}>
          {e.retirada ? <Check className="w-6 h-6 text-green-600" /> : <Package className="w-6 h-6 text-primary" />}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{e.remetente || "Encomenda"}</p>
        {e.descricao && <p className="text-xs text-muted-foreground">{e.descricao}</p>}
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />Chegou {fmt(e.createdAt)}</p>
        {e.retirada && e.retiradaEm && (
          <p className="text-xs text-green-700 mt-0.5">Retirada {fmt(e.retiradaEm)}{e.retiradoPor ? ` por ${e.retiradoPor}` : ""}</p>
        )}
      </div>
    </div>
  )

  return (
    <div className="px-4 py-5 space-y-5">
      <div>
        <h1 className="font-heading text-xl font-semibold">Encomendas</h1>
        <p className="text-sm text-muted-foreground">Pacotes recebidos pela portaria para você.</p>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Package className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Nenhuma encomenda registrada ainda.</p>
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aguardando retirada ({aguardando.length})</p>
            {aguardando.length === 0 ? <p className="text-sm text-muted-foreground">Nada pendente na portaria.</p> : aguardando.map((e) => <Item key={e.id} e={e} />)}
          </section>
          {retiradas.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Histórico</p>
              {retiradas.map((e) => <Item key={e.id} e={e} />)}
            </section>
          )}
        </>
      )}
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { Vote } from "lucide-react"
import { EnqueteCard, type Enquete } from "@/components/enquetes/enquete-card"

export default function MoradorEnquetesPage() {
  const [lista, setLista] = useState<Enquete[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    const res = await fetch("/api/enquetes")
    if (res.ok) setLista((await res.json()).enquetes)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const abertas = lista.filter((e) => !e.encerrada)
  const encerradas = lista.filter((e) => e.encerrada)

  return (
    <div className="px-4 py-5 space-y-5">
      <div>
        <h1 className="font-heading text-xl font-semibold">Enquetes</h1>
        <p className="text-sm text-muted-foreground">Sua opinião ajuda nas decisões do condomínio.</p>
      </div>
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Vote className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Nenhuma enquete no momento.</p>
        </div>
      ) : (
        <>
          {abertas.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Abertas</p>
              {abertas.map((e) => <EnqueteCard key={e.id} enquete={e} podeVotar onAtualizado={carregar} />)}
            </section>
          )}
          {encerradas.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Encerradas</p>
              {encerradas.map((e) => <EnqueteCard key={e.id} enquete={e} podeVotar onAtualizado={carregar} />)}
            </section>
          )}
        </>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { rotuloCategoria } from "@/lib/equipamentos"

interface Eq { id: string; nome: string; categoria: string; local: string | null }

/** Folha de etiquetas com QR Code para colar nos equipamentos (A4, 3 colunas). */
export default function EtiquetasPage() {
  const { usuario } = useAuth()
  const [lista, setLista] = useState<Eq[]>([])
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id")
    fetch("/api/equipamentos")
      .then((r) => r.json())
      .then((d) => {
        const todos: Eq[] = d.equipamentos ?? []
        setLista(id ? todos.filter((e) => e.id === id) : todos)
        setCarregado(true)
      })
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/equipamentos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Equipamentos
        </Link>
        <Button size="sm" onClick={() => window.print()} disabled={!carregado || lista.length === 0}>
          <Printer className="h-4 w-4 mr-2" /> Imprimir {lista.length} etiqueta{lista.length === 1 ? "" : "s"}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 print:grid-cols-3 print:gap-3">
        {lista.map((e) => (
          <div key={e.id} className="rounded-xl border-2 border-dashed border-border bg-white p-4 flex flex-col items-center text-center break-inside-avoid">
            <p className="text-[11px] font-bold tracking-wide text-[#1C1410]">Zelo<span className="text-[#B84A2E]">H</span></p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/equipamentos/${e.id}/qrcode`} alt="" className="w-32 h-32 my-2" />
            <p className="text-sm font-semibold text-[#1C1410] leading-tight">{e.nome}</p>
            <p className="text-[11px] text-[#7C6E66] mt-0.5">{rotuloCategoria(e.categoria)}{e.local ? ` · ${e.local}` : ""}</p>
            <p className="text-[10px] text-[#7C6E66] mt-1">{usuario?.condominio.nome}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

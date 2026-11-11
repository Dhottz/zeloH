"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { AtivarPush } from "@/components/notificacoes/ativar-push"

interface Notif {
  id: string
  titulo: string
  descricao: string | null
  link: string
  lidaEm: string | null
  criadaEm: string
}

function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000)
  if (min < 1) return "agora"
  if (min < 60) return `${min}min`
  if (h < 24) return `${h}h`
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

/** Sininho de notificações pessoais (encomendas, comunicados, chamados…). */
export function MoradorSino() {
  const [aberto, setAberto] = useState(false)
  const [itens, setItens] = useState<Notif[]>([])
  const [naoLidas, setNaoLidas] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const carregar = useCallback(async () => {
    const res = await fetch("/api/notificacoes/minhas")
    if (!res.ok) return
    const data = await res.json()
    setItens(data.notificacoes ?? [])
    setNaoLidas(data.naoLidas ?? 0)
  }, [])

  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 60_000)
    return () => clearInterval(t)
  }, [carregar])

  useEffect(() => {
    if (!aberto) return
    const fechar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener("mousedown", fechar)
    return () => document.removeEventListener("mousedown", fechar)
  }, [aberto])

  const abrir = async () => {
    const vaiAbrir = !aberto
    setAberto(vaiAbrir)
    if (vaiAbrir && naoLidas > 0) {
      await fetch("/api/notificacoes/minhas", { method: "PATCH" })
      setNaoLidas(0)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={abrir}
        className="relative p-2 rounded-xl hover:bg-accent/60 transition-colors"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5 text-foreground" />
        {naoLidas > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 max-w-[calc(100vw-2rem)] bg-background rounded-2xl border border-border shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Notificações</p>
            <AtivarPush compacto />
          </div>
          <div className="max-h-96 overflow-y-auto">
            {itens.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação por aqui.</p>
            ) : (
              itens.map((n) => (
                <Link
                  key={n.id}
                  href={n.link}
                  onClick={() => setAberto(false)}
                  className={cn(
                    "block px-4 py-3 border-b border-border last:border-0 hover:bg-accent/40 transition-colors",
                    !n.lidaEm && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground leading-snug">{n.titulo}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{tempoRelativo(n.criadaEm)}</span>
                  </div>
                  {n.descricao && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.descricao}</p>}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

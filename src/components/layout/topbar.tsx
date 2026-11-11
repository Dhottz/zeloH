"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Bell, Menu, AlertCircle, CalendarClock, Package, X, HardHat } from "lucide-react"
import { Logo } from "./logo"
import { cn } from "@/lib/utils"
import type { NotificacaoItem } from "@/app/api/notificacoes/route"
import Link from "next/link"

// ─── Config ───────────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<NotificacaoItem["tipo"], {
  icon: React.ReactNode
  cor: string
}> = {
  CHAMADO:      { icon: <AlertCircle   className="w-3.5 h-3.5" />, cor: "bg-orange-100 text-orange-600" },
  RESERVA:      { icon: <CalendarClock className="w-3.5 h-3.5" />, cor: "bg-blue-100 text-blue-600" },
  ENTREGA:      { icon: <Package       className="w-3.5 h-3.5" />, cor: "bg-green-100 text-green-700" },
  ZELADOR_ACAO: { icon: <HardHat       className="w-3.5 h-3.5" />, cor: "bg-violet-100 text-violet-600" },
}

const LS_KEY          = "zeloh_notif_lida_ate"
const LS_LIMPAS_KEY   = "zeloh_notif_limpas"

function getLimpas(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_LIMPAS_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function saveLimpas(ids: Set<string>) {
  localStorage.setItem(LS_LIMPAS_KEY, JSON.stringify([...ids]))
}

function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  const h    = Math.floor(diff / 3600000)
  const d    = Math.floor(diff / 86400000)
  if (min  <  1) return "agora"
  if (min  < 60) return `${min}min`
  if (h    < 24) return `${h}h`
  if (d    <  7) return `${d}d`
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopbarProps {
  onMenuClick?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Topbar({ onMenuClick }: TopbarProps) {
  const [aberto, setAberto]               = useState(false)
  const [notificacoes, setNotificacoes]   = useState<NotificacaoItem[]>([])
  const [ultimaLeitura, setUltimaLeitura] = useState<number>(0)
  const [limpas, setLimpas]               = useState<Set<string>>(new Set())
  const [loading, setLoading]             = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Carrega estado do localStorage
  useEffect(() => {
    const salvo = localStorage.getItem(LS_KEY)
    if (salvo) setUltimaLeitura(Number(salvo))
    setLimpas(getLimpas())
  }, [])

  const fetchNotificacoes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/notificacoes")
      if (res.ok) {
        const data = await res.json()
        setNotificacoes(data.notificacoes ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Carrega ao montar
  useEffect(() => {
    fetchNotificacoes()
  }, [fetchNotificacoes])

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [aberto])

  const visiveis = notificacoes.filter((n) => !limpas.has(n.id))

  const naoLidas = visiveis.filter(
    (n) => new Date(n.createdAt).getTime() > ultimaLeitura
  ).length

  const limparTodas = () => {
    const novas = new Set([...limpas, ...notificacoes.map((n) => n.id)])
    setLimpas(novas)
    saveLimpas(novas)
  }

  const abrirDropdown = () => {
    if (!aberto) {
      fetchNotificacoes()
      setAberto(true)
      // Marca como lido ao abrir
      const agora = Date.now()
      setUltimaLeitura(agora)
      localStorage.setItem(LS_KEY, String(agora))
    } else {
      setAberto(false)
    }
  }

  return (
    <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10 flex items-center px-4 lg:px-6 gap-3">
      {/* Hamburguer — visível só no mobile */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-accent/60 text-muted-foreground transition-colors -ml-1"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Logo mobile */}
      <div className="lg:hidden flex-1">
        <Logo size="sm" />
      </div>

      {/* Spacer desktop */}
      <div className="hidden lg:flex flex-1" />

      {/* Notificações */}
      <div ref={containerRef} className="relative ml-auto lg:ml-0">
        <button
          onClick={abrirDropdown}
          className="relative p-2 rounded-lg hover:bg-accent/60 transition-colors"
          aria-label="Notificações"
        >
          <Bell className={cn("w-4 h-4", aberto ? "text-foreground" : "text-muted-foreground")} />
          {naoLidas > 0 && (
            <span className="absolute top-1 right-1 min-w-[14px] h-[14px] bg-primary rounded-full text-[9px] font-bold text-primary-foreground flex items-center justify-center px-0.5">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {aberto && (
          <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-background shadow-lg overflow-hidden z-50">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Notificações</p>
              <div className="flex items-center gap-2">
                {visiveis.length > 0 && (
                  <button
                    onClick={limparTodas}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Limpar tudo
                  </button>
                )}
                <button onClick={() => setAberto(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Lista */}
            <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : visiveis.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-2 text-center px-4">
                  <Bell className="w-8 h-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                </div>
              ) : (
                visiveis.map((n) => {
                  const cfg    = TIPO_CONFIG[n.tipo]
                  const naoLida = new Date(n.createdAt).getTime() > ultimaLeitura
                  return (
                    <Link
                      key={n.id}
                      href={n.href}
                      onClick={() => setAberto(false)}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors",
                        naoLida && "bg-primary/5"
                      )}
                    >
                      {/* Ícone */}
                      <div className={cn("mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center", cfg.cor)}>
                        {cfg.icon}
                      </div>

                      {/* Texto */}
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs leading-snug truncate", naoLida ? "font-semibold text-foreground" : "font-medium text-foreground")}>
                          {n.titulo}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                          {n.descricao}
                        </p>
                      </div>

                      {/* Tempo */}
                      <span className="shrink-0 text-[10px] text-muted-foreground mt-0.5">
                        {tempoRelativo(n.createdAt)}
                      </span>
                    </Link>
                  )
                })
              )}
            </div>

            {/* Footer */}
            {visiveis.length > 0 && (
              <div className="border-t border-border px-4 py-2.5 text-center">
                <p className="text-[11px] text-muted-foreground">
                  {visiveis.length} item{visiveis.length !== 1 ? "s" : ""} ativos
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  CalendarClock, Megaphone, AlertCircle, Package,
  ChevronRight, Clock, CheckCircle2, XCircle, Pin,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { cn, fetchJson } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

type ReservaStatus = "PENDENTE" | "CONFIRMADA" | "CANCELADA"
type ComunicadoTipo = "AVISO" | "URGENTE" | "MANUTENCAO" | "EVENTO" | "OUTRO"

interface ProximaReserva {
  id: string
  data: string
  horaInicio: string
  horaFim: string
  status: ReservaStatus
  area: { id: string; nome: string }
}

interface UltimoComunicado {
  id: string
  titulo: string
  tipo: ComunicadoTipo
  fixado: boolean
  createdAt: string
  expiraEm: string | null
}

interface Summary {
  stats: {
    reservasAtivas: number
    comunicadosPublicados: number
    chamadosAbertos: number
    entregasAguardando: number
  }
  proximasReservas: ProximaReserva[]
  ultimosComunicados: UltimoComunicado[]
}

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ReservaStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDENTE:   { label: "Pendente",   color: "bg-amber-50 text-amber-700 border-amber-200",  icon: <Clock        className="h-3 w-3" /> },
  CONFIRMADA: { label: "Confirmada", color: "bg-green-50 text-green-700 border-green-200",  icon: <CheckCircle2 className="h-3 w-3" /> },
  CANCELADA:  { label: "Cancelada",  color: "bg-red-50   text-red-700   border-red-200",    icon: <XCircle      className="h-3 w-3" /> },
}

const TIPO_COLOR: Record<ComunicadoTipo, string> = {
  AVISO:      "bg-blue-50 text-blue-700 border-blue-200",
  URGENTE:    "bg-red-50 text-red-700 border-red-200",
  MANUTENCAO: "bg-orange-50 text-orange-700 border-orange-200",
  EVENTO:     "bg-purple-50 text-purple-700 border-purple-200",
  OUTRO:      "bg-gray-50 text-gray-700 border-gray-200",
}

const TIPO_LABEL: Record<ComunicadoTipo, string> = {
  AVISO:      "Aviso",
  URGENTE:    "Urgente",
  MANUTENCAO: "Manutenção",
  EVENTO:     "Evento",
  OUTRO:      "Outro",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtData(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
}

function fmtRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const dias = Math.floor(diff / 86400000)
  if (dias === 0) return "hoje"
  if (dias === 1) return "ontem"
  if (dias < 7)  return `${dias}d atrás`
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MoradorHomePage() {
  const { usuario } = useAuth()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchJson<Summary>("/api/morador/summary")
      .then((d) => setSummary(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const nomeAbreviado = usuario?.nome.split(" ")[0] ?? "..."
  const identificacao = [usuario?.bloco && `Bloco ${usuario.bloco}`, usuario?.unidade && `Apto ${usuario.unidade}`]
    .filter(Boolean).join(" · ") || usuario?.email

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="bg-primary px-5 pt-6 pb-8">
        <p className="text-primary-foreground/70 text-sm mb-0.5">Olá,</p>
        <h1 className="text-primary-foreground text-2xl font-bold font-heading">{nomeAbreviado} 👋</h1>
        {identificacao && (
          <p className="text-primary-foreground/70 text-sm mt-1">{identificacao}</p>
        )}
        <p className="text-primary-foreground/60 text-xs mt-0.5">{usuario?.condominio?.nome}</p>
      </div>

      {/* Stats */}
      <div className="px-4 -mt-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: "Reservas ativas",
              value: summary?.stats.reservasAtivas ?? "–",
              icon: <CalendarClock className="w-4 h-4" />,
              href: "/morador/reservas",
              color: "text-blue-600",
              bg: "bg-blue-50",
            },
            {
              label: "Comunicados",
              value: summary?.stats.comunicadosPublicados ?? "–",
              icon: <Megaphone className="w-4 h-4" />,
              href: "/morador/comunicados",
              color: "text-purple-600",
              bg: "bg-purple-50",
            },
            {
              label: "Chamados abertos",
              value: summary?.stats.chamadosAbertos ?? "–",
              icon: <AlertCircle className="w-4 h-4" />,
              href: "/morador/ocorrencias",
              color: "text-orange-600",
              bg: "bg-orange-50",
            },
            {
              label: "Entregas",
              value: summary?.stats.entregasAguardando ?? "–",
              icon: <Package className="w-4 h-4" />,
              href: undefined,
              color: "text-green-600",
              bg: "bg-green-50",
            },
          ].map(({ label, value, icon, href, color, bg }) => {
            const inner = (
              <div className="bg-background rounded-2xl p-4 shadow-sm border border-border flex flex-col gap-2">
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", bg)}>
                  <span className={color}>{icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{loading ? "–" : value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            )
            return href ? (
              <Link key={label} href={href}>{inner}</Link>
            ) : (
              <div key={label}>{inner}</div>
            )
          })}
        </div>
      </div>

      {/* Próximas Reservas */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm text-foreground">Próximas reservas</h2>
          <Link href="/morador/reservas" className="text-xs text-primary flex items-center gap-0.5">
            Ver todas <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="bg-background rounded-2xl p-4 border border-border text-sm text-muted-foreground text-center">
            Carregando...
          </div>
        ) : summary?.proximasReservas.length === 0 ? (
          <div className="bg-background rounded-2xl p-4 border border-border text-center">
            <CalendarClock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma reserva ativa</p>
            <Link href="/morador/reservas" className="text-xs text-primary mt-1 block">
              Fazer uma reserva →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {summary?.proximasReservas.map((r) => {
              const sc = STATUS_CONFIG[r.status]
              return (
                <div key={r.id} className="bg-background rounded-2xl p-4 border border-border flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{r.area.nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fmtData(r.data)} · {r.horaInicio}–{r.horaFim}
                    </p>
                  </div>
                  <Badge className={cn("text-[10px] border flex items-center gap-1 shrink-0", sc.color)}>
                    {sc.icon}{sc.label}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Últimos Comunicados */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm text-foreground">Comunicados recentes</h2>
          <Link href="/morador/comunicados" className="text-xs text-primary flex items-center gap-0.5">
            Ver todos <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="bg-background rounded-2xl p-4 border border-border text-sm text-muted-foreground text-center">
            Carregando...
          </div>
        ) : summary?.ultimosComunicados.length === 0 ? (
          <div className="bg-background rounded-2xl p-4 border border-border text-center">
            <p className="text-sm text-muted-foreground">Nenhum comunicado recente</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {summary?.ultimosComunicados.map((c) => (
              <Link key={c.id} href="/morador/comunicados">
                <div className="bg-background rounded-2xl p-4 border border-border">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge className={cn("text-[10px] border", TIPO_COLOR[c.tipo])}>
                          {TIPO_LABEL[c.tipo]}
                        </Badge>
                        {c.fixado && (
                          <Pin className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground line-clamp-2">{c.titulo}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{fmtRelativo(c.createdAt)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="h-4" />
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, CalendarClock, Package, Wrench, ArrowRight, AlertTriangle, Info, CheckCircle2, Bell, Wallet } from "lucide-react"
import { MetricCard } from "@/components/dashboard/metric-card"
import { ZiaSuggestion } from "@/components/dashboard/zia-suggestion"
import { OccurrencesChart } from "@/components/dashboard/occurrences-chart"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { cn, formatDateTime, formatMoeda } from "@/lib/utils"

const statusCor: Record<string, string> = {
  ABERTO:               "bg-red-100 text-red-700",
  EM_ANDAMENTO:         "bg-yellow-100 text-yellow-700",
  AGUARDANDO_PRESTADOR: "bg-orange-100 text-orange-700",
  CONCLUIDO:            "bg-green-100 text-green-700",
  CANCELADO:            "bg-gray-100 text-gray-500",
}

const statusLabel: Record<string, string> = {
  ABERTO:               "Aberto",
  EM_ANDAMENTO:         "Em andamento",
  AGUARDANDO_PRESTADOR: "Aguardando",
  CONCLUIDO:            "Concluído",
  CANCELADO:            "Cancelado",
}

interface DashboardData {
  metricas: {
    ocorrenciasAbertas: number
    encomendasHoje: number
    encomendasAguardando: number
    reservasPendentes: number
    manutencoesSemana: number
    manutencoesAtrasadas: number
    despesasMes: number | null
  }
  atencao: Array<{ id: string; severidade: "critico" | "alerta" | "info"; titulo: string; descricao: string; href: string }>
  ultimosChamados: Array<{
    id: string
    titulo: string
    status: string
    prioridade: string
    createdAt: string
    morador: string
    unidade: string | null
  }>
  proximasManutencoes: Array<{
    id: string
    titulo: string
    agendadoEm: string | null
    prestadorNome: string | null
    equipamento: string | null
    tipo: string
    status: string
  }>
}

const SEVERIDADE = {
  critico: { icone: AlertTriangle, cor: "bg-red-100 text-red-700", rotulo: "Urgente" },
  alerta:  { icone: Bell,          cor: "bg-amber-100 text-amber-800", rotulo: "Atenção" },
  info:    { icone: Info,          cor: "bg-blue-50 text-blue-700", rotulo: "Info" },
} as const

function PrecisaAtencao({ itens, loading }: { itens: DashboardData["atencao"]; loading: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Precisa da sua atenção</h2>
        {!loading && itens.length > 0 && <span className="text-xs text-muted-foreground">{itens.length} item(ns)</span>}
      </div>
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : itens.length === 0 ? (
        <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
          <CheckCircle2 className="w-5 h-5 text-green-600" /> Tudo em dia. Nenhuma pendência no momento.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {itens.slice(0, 8).map((i) => {
            const sv = SEVERIDADE[i.severidade]
            return (
              <Link key={i.id} href={i.href} className="flex items-center gap-3 py-2.5 group">
                <div className={cn("rounded-lg p-1.5 shrink-0", sv.cor)}><sv.icone className="w-3.5 h-3.5" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{i.titulo}</p>
                  <p className="text-xs text-muted-foreground truncate">{i.descricao}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export default function DashboardPage() {
  const { usuario } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/dashboard/summary")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const primeiroNome = usuario?.nome?.split(" ")[0] ?? "..."
  const hoje = new Date()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Bom dia, {primeiroNome}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visão geral do {usuario?.condominio?.nome ?? "seu condomínio"} —{" "}
            {hoje.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
          </p>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-3 w-32" />
            </Card>
          ))
        ) : (
          <>
            <MetricCard
              title="Ocorrências abertas"
              value={data?.metricas.ocorrenciasAbertas ?? 0}
              icon={AlertCircle}
            />
            <MetricCard
              title="Reservas pendentes"
              value={data?.metricas.reservasPendentes ?? 0}
              icon={CalendarClock}
              subtitle="aguardam confirmação"
            />
            <MetricCard
              title="Encomendas na portaria"
              value={data?.metricas.encomendasAguardando ?? 0}
              icon={Package}
              subtitle={`${data?.metricas.encomendasHoje ?? 0} chegaram hoje`}
            />
            {data?.metricas.despesasMes != null ? (
              <MetricCard
                title="Despesas do mês"
                value={formatMoeda(data.metricas.despesasMes)}
                icon={Wallet}
                subtitle={`${data.metricas.manutencoesAtrasadas} manutenção(ões) atrasada(s)`}
              />
            ) : (
              <MetricCard
                title="Manutenções na semana"
                value={data?.metricas.manutencoesSemana ?? 0}
                icon={Wrench}
                subtitle={`${data?.metricas.manutencoesAtrasadas ?? 0} atrasada(s)`}
              />
            )}
          </>
        )}
      </div>

      {/* Pendências + ZileIA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PrecisaAtencao itens={data?.atencao ?? []} loading={loading} />
        </div>
        <ZiaSuggestion
          message={
            data?.atencao?.length
              ? `Hoje o mais importante é: ${data.atencao[0].titulo.toLowerCase()}. Posso te ajudar a resolver ou redigir um comunicado.`
              : "Tudo em dia por aqui. Quer que eu prepare o resumo do mês para a próxima assembleia?"
          }
          action={{ label: "Falar com a ZileIA", onClick: () => window.location.href = "/zia" }}
        />
      </div>

      <OccurrencesChart condominioId={usuario?.condominio?.id} />

      {/* Últimas ocorrências + Manutenções */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Últimas ocorrências */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Últimas ocorrências</h2>
            <Button variant="ghost" size="sm" className="text-xs text-primary gap-1 h-7"
              onClick={() => window.location.href = "/ocorrencias"}>
              Ver todas <ArrowRight className="w-3 h-3" />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded" />
                </div>
              ))}
            </div>
          ) : data?.ultimosChamados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma ocorrência registrada ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {data?.ultimosChamados.map((oc) => (
                <div key={oc.id} className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{oc.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {oc.morador}{oc.unidade ? ` · ${oc.unidade}` : ""} · {formatDateTime(oc.createdAt)}
                    </p>
                  </div>
                  <Badge className={`text-[10px] shrink-0 border-0 ${statusCor[oc.status] ?? "bg-muted text-muted-foreground"}`}>
                    {statusLabel[oc.status] ?? oc.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Próximas manutenções */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Manutenções desta semana</h2>
            <Button variant="ghost" size="sm" className="text-xs text-primary gap-1 h-7"
              onClick={() => window.location.href = "/manutencoes"}>
              Ver agenda <ArrowRight className="w-3 h-3" />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : data?.proximasManutencoes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma manutenção agendada.
            </p>
          ) : (
            <div className="space-y-3">
              {data?.proximasManutencoes.map((m) => {
                const data_m = m.agendadoEm ? new Date(m.agendadoEm) : null
                return (
                  <div key={m.id} className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                    <div className="w-10 h-10 rounded-lg bg-muted flex flex-col items-center justify-center shrink-0">
                      {data_m ? (
                        <>
                          <span className="text-sm font-bold text-foreground leading-none">
                            {data_m.getDate().toString().padStart(2, "0")}
                          </span>
                          <span className="text-[9px] text-muted-foreground uppercase">
                            {data_m.toLocaleString("pt-BR", { month: "short" })}
                          </span>
                        </>
                      ) : (
                        <Wrench className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {[m.equipamento, m.prestadorNome].filter(Boolean).join(" · ") || "Equipe interna"}
                      </p>
                    </div>
                    <Badge className={cn("text-[10px] shrink-0 border-0", m.tipo === "PREVENTIVA" ? "bg-green-100 text-green-700" : "bg-red-50 text-red-700")}>
                      {m.tipo === "PREVENTIVA" ? "Preventiva" : "Corretiva"}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

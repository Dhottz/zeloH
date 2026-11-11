"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Cog, Plus, Search, QrCode, AlertTriangle, CalendarClock, ShieldCheck, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/textarea"
import { PageHeader, EstadoVazio, StatCard } from "@/components/shared/page-header"
import { ModuloGate } from "@/components/shared/modulo-gate"
import { EquipamentoForm, type EquipamentoBase } from "@/components/equipamentos/equipamento-form"
import { useAuth } from "@/hooks/use-auth"
import { podeGerenciar } from "@/lib/permissions"
import { CATEGORIAS_EQUIPAMENTO, rotuloCategoria } from "@/lib/equipamentos"
import { urlArquivo } from "@/lib/arquivos"
import { cn, diasAte, formatDate } from "@/lib/utils"

interface Equipamento extends EquipamentoBase {
  proximaPreventiva: string | null
  osAbertas: number
  osAtrasadas: number
  _count: { manutencoes: number; chamados: number }
}

function Conteudo() {
  const { usuario } = useAuth()
  const gestor = podeGerenciar(usuario?.role)
  const [lista, setLista] = useState<Equipamento[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState("")
  const [categoria, setCategoria] = useState("")
  const [form, setForm] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({ ...(busca && { busca }), ...(categoria && { categoria }) })
    const res = await fetch(`/api/equipamentos?${qs}`)
    if (res.ok) setLista((await res.json()).equipamentos)
    setLoading(false)
  }, [busca, categoria])

  useEffect(() => {
    const t = setTimeout(carregar, busca ? 300 : 0)
    return () => clearTimeout(t)
  }, [carregar, busca])

  const atrasados = lista.filter((e) => e.osAtrasadas > 0).length
  const semPlano  = lista.filter((e) => !e.proximaPreventiva).length
  const garantia  = lista.filter((e) => { const d = diasAte(e.garantiaAte); return d !== null && d >= 0 && d <= 60 }).length

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Equipamentos"
        descricao="Inventário com histórico de manutenção, planos preventivos e QR Code."
        acoes={
          <>
            {lista.length > 0 && (
              <Link href="/equipamentos/etiquetas">
                <Button size="sm" variant="outline"><QrCode className="h-4 w-4 mr-2" />Imprimir etiquetas</Button>
              </Link>
            )}
            {gestor && <Button size="sm" onClick={() => setForm(true)}><Plus className="h-4 w-4 mr-2" />Novo equipamento</Button>}
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icone={Cog} rotulo="Equipamentos" valor={lista.length} />
        <StatCard icone={AlertTriangle} rotulo="Com manutenção atrasada" valor={atrasados} tom={atrasados ? "perigo" : "ok"} />
        <StatCard icone={CalendarClock} rotulo="Sem plano preventivo" valor={semPlano} tom={semPlano ? "alerta" : "ok"} />
        <StatCard icone={ShieldCheck} rotulo="Garantia vence em 60 dias" valor={garantia} tom={garantia ? "alerta" : "padrao"} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, local, marca, série..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <NativeSelect className="w-52 h-9" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS_EQUIPAMENTO.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
        </NativeSelect>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : lista.length === 0 ? (
        <EstadoVazio
          icone={Cog}
          titulo={busca || categoria ? "Nenhum equipamento encontrado" : "Nenhum equipamento cadastrado"}
          descricao="Cadastre elevadores, bombas, portões e sistemas de incêndio para acompanhar o histórico de cada um."
          acao={gestor && !busca ? <Button size="sm" variant="outline" onClick={() => setForm(true)}><Plus className="h-4 w-4 mr-2" />Cadastrar o primeiro</Button> : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map((e) => {
            const diasPrev = diasAte(e.proximaPreventiva)
            return (
              <Link
                key={e.id}
                href={`/equipamentos/${e.id}`}
                className={cn(
                  "rounded-xl border bg-card p-4 flex gap-3 hover:shadow-md hover:border-primary/40 transition-all",
                  e.osAtrasadas ? "border-red-200" : "border-border",
                  !e.ativo && "opacity-60"
                )}
              >
                {e.fotos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urlArquivo(e.fotos[0])} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Cog className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-medium leading-snug">{e.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {rotuloCategoria(e.categoria)}{e.local ? ` · ${e.local}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {e.osAtrasadas > 0 && (
                      <span className="text-[10px] font-semibold rounded-full bg-red-100 text-red-700 px-2 py-0.5">{e.osAtrasadas} atrasada(s)</span>
                    )}
                    {e.osAbertas > 0 && !e.osAtrasadas && (
                      <span className="text-[10px] font-medium rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 flex items-center gap-1">
                        <Wrench className="h-3 w-3" />{e.osAbertas} em aberto
                      </span>
                    )}
                    {e.proximaPreventiva ? (
                      <span className={cn("text-[10px] font-medium rounded-full px-2 py-0.5", diasPrev !== null && diasPrev < 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700")}>
                        Preventiva {formatDate(e.proximaPreventiva)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 px-2 py-0.5">Sem plano</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <EquipamentoForm aberto={form} onFechar={() => setForm(false)} onSalvo={() => carregar()} />
    </div>
  )
}

export default function EquipamentosPage() {
  return <ModuloGate modulo="equipamentos"><Conteudo /></ModuloGate>
}

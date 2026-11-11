"use client"

import { useEffect, useState, useCallback } from "react"
import {
  CalendarClock, Plus, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Clock, Loader2,
  Users, ArrowLeft, Lock, AlarmClock, Hash,
} from "lucide-react"
import { Button }  from "@/components/ui/button"
import { Input }   from "@/components/ui/input"
import { Label }   from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

type ReservaStatus = "PENDENTE" | "CONFIRMADA" | "CANCELADA"

interface AreaComum {
  id:                string
  nome:              string
  descricao:         string | null
  capacidade:        number | null
  ativa:             boolean
  horarioAbertura:   string
  horarioFechamento: string
  maxReservasPorDia: number | null
  duracaoMaxMinutos: number | null
}

interface Reserva {
  id:         string
  data:       string
  horaInicio: string
  horaFim:    string
  status:     ReservaStatus
  observacao: string | null
  area:       { id: string; nome: string }
  morador:    { id: string; nome: string; unidade: string | null; bloco: string | null }
}

interface Slot {
  horaInicio: string
  horaFim:    string
  disponivel: boolean
  reserva:    { id: string; status: string; minha: boolean; morador: { id: string; nome: string; unidade: string | null } | null } | null
}

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ReservaStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDENTE:   { label: "Pendente",   color: "bg-amber-50 text-amber-700 border-amber-200",  icon: <Clock        className="h-3 w-3" /> },
  CONFIRMADA: { label: "Confirmada", color: "bg-green-50 text-green-700 border-green-200",  icon: <CheckCircle2 className="h-3 w-3" /> },
  CANCELADA:  { label: "Cancelada",  color: "bg-muted text-muted-foreground border-border", icon: <XCircle      className="h-3 w-3" /> },
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
const DIAS  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]

function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function labelMes(mes: string) {
  const [ano, m] = mes.split("-")
  return `${MESES[parseInt(m) - 1]} ${ano}`
}

function fmtDuracao(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

type View = "areas" | "agenda"

// ─── Component ───────────────────────────────────────────────────────────────

export default function MoradorReservasPage() {
  const [view, setView]           = useState<View>("areas")
  const [areas, setAreas]         = useState<AreaComum[]>([])
  const [areaAtiva, setAreaAtiva] = useState<AreaComum | null>(null)

  // Agenda
  const [mes, setMes]                   = useState(mesAtual())
  const [dataAtiva, setDataAtiva]       = useState<string | null>(null)
  const [slots, setSlots]               = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [reservasMes, setReservasMes]   = useState<Reserva[]>([])
  const [limiteAtingido, setLimiteAtingido] = useState(false)

  // Modal reserva
  const [modalReserva, setModalReserva]       = useState(false)
  const [slotSelecionado, setSlotSelecionado] = useState<Slot | null>(null)
  const [observacao, setObservacao]           = useState("")
  const [salvandoReserva, setSalvandoReserva] = useState(false)

  const [feedback, setFeedback] = useState<{ type: "ok" | "erro"; text: string } | null>(null)

  const showFeedback = (type: "ok" | "erro", text: string) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4000)
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAreas = useCallback(async () => {
    const res = await fetch("/api/areas")
    if (res.ok) {
      const data = await res.json()
      setAreas((data.areas ?? []).filter((a: AreaComum) => a.ativa))
    }
  }, [])

  const fetchReservasMes = useCallback(async (areaId: string, mesStr: string) => {
    const params = new URLSearchParams({ mes: mesStr, areaId })
    const res = await fetch(`/api/reservas?${params}`)
    if (res.ok) {
      const data = await res.json()
      setReservasMes(data.reservas ?? [])
    }
  }, [])

  const fetchSlots = useCallback(async (areaId: string, data: string) => {
    setLoadingSlots(true)
    try {
      const res = await fetch(`/api/areas/${areaId}/slots?data=${data}`)
      if (res.ok) {
        const json = await res.json()
        setSlots(json.slots)
        setLimiteAtingido(json.limiteAtingido)
      }
    } finally {
      setLoadingSlots(false)
    }
  }, [])

  useEffect(() => { fetchAreas() }, [fetchAreas])

  useEffect(() => {
    if (areaAtiva) fetchReservasMes(areaAtiva.id, mes)
  }, [areaAtiva, mes, fetchReservasMes])

  useEffect(() => {
    if (areaAtiva && dataAtiva) fetchSlots(areaAtiva.id, dataAtiva)
  }, [areaAtiva, dataAtiva, fetchSlots])

  // ── Ações ──────────────────────────────────────────────────────────────────

  const abrirAgenda = (area: AreaComum) => {
    setAreaAtiva(area)
    setDataAtiva(null)
    setSlots([])
    const hoje = new Date()
    setMes(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`)
    setView("agenda")
  }

  const navMes = (delta: number) => {
    const [ano, m] = mes.split("-").map(Number)
    const d = new Date(ano, m - 1 + delta, 1)
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  const abrirModalReserva = (slot: Slot) => {
    if (!slot.disponivel || limiteAtingido) return
    setSlotSelecionado(slot)
    setObservacao("")
    setModalReserva(true)
  }

  const handleSalvarReserva = async () => {
    if (!areaAtiva || !dataAtiva || !slotSelecionado) return
    setSalvandoReserva(true)
    try {
      const res = await fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          areaId:     areaAtiva.id,
          data:       dataAtiva,
          horaInicio: slotSelecionado.horaInicio,
          horaFim:    slotSelecionado.horaFim,
          observacao: observacao || null,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        showFeedback("ok", "Reserva solicitada!")
        setModalReserva(false)
        fetchSlots(areaAtiva.id, dataAtiva)
        fetchReservasMes(areaAtiva.id, mes)
      } else {
        showFeedback("erro", json.message ?? "Erro ao reservar.")
      }
    } catch { showFeedback("erro", "Erro de conexão.") }
    finally  { setSalvandoReserva(false) }
  }

  const handleCancelar = async (id: string) => {
    if (!confirm("Cancelar esta reserva?")) return
    const res = await fetch(`/api/reservas/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELADA" }),
    })
    if (res.ok) {
      showFeedback("ok", "Reserva cancelada.")
      if (areaAtiva && dataAtiva) fetchSlots(areaAtiva.id, dataAtiva)
      if (areaAtiva) fetchReservasMes(areaAtiva.id, mes)
    } else {
      showFeedback("erro", "Erro ao cancelar.")
    }
  }

  // ── Calendário ─────────────────────────────────────────────────────────────

  const diasNoMes = () => {
    const [ano, m] = mes.split("-").map(Number)
    const primeiro = new Date(ano, m - 1, 1)
    const ultimo   = new Date(ano, m, 0)
    const diasAnt  = primeiro.getDay()
    const dias: Array<{ data: string | null; temReserva: boolean }> = []

    for (let i = 0; i < diasAnt; i++) dias.push({ data: null, temReserva: false })

    for (let d = 1; d <= ultimo.getDate(); d++) {
      const dataStr    = `${ano}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      const temReserva = reservasMes.some((r) => r.data.slice(0, 10) === dataStr)
      dias.push({ data: dataStr, temReserva })
    }

    return dias
  }

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col">

      {/* Header */}
      <div className="bg-background sticky top-0 z-10 border-b px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-1">
          {view === "agenda" && (
            <button
              onClick={() => setView("areas")}
              className="h-8 w-8 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-heading text-lg font-bold truncate">
              {view === "agenda" && areaAtiva ? areaAtiva.nome : "Reservas"}
            </h1>
            {view === "agenda" && areaAtiva && (
              <p className="text-xs text-muted-foreground truncate">
                {areaAtiva.horarioAbertura} – {areaAtiva.horarioFechamento}
                {areaAtiva.capacidade ? ` · até ${areaAtiva.capacidade} pessoas` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={cn("mx-4 mt-3 rounded-lg px-4 py-3 text-sm font-medium border",
          feedback.type === "ok" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"
        )}>{feedback.text}</div>
      )}

      {/* ── View: Áreas ── */}
      {view === "areas" && (
        <div className="px-4 py-4">
          {areas.length === 0 ? (
            <div className="flex flex-col items-center py-14 gap-3 text-center">
              <CalendarClock className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhuma área disponível.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {areas.map((area) => (
                <Card
                  key={area.id}
                  className="cursor-pointer transition-all border hover:shadow-md hover:border-primary/40"
                  onClick={() => abrirAgenda(area)}
                >
                  <CardContent className="p-4 space-y-2.5">
                    <h3 className="font-semibold text-foreground">{area.nome}</h3>
                    {area.descricao && (
                      <p className="text-sm text-muted-foreground leading-snug line-clamp-2">{area.descricao}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-md px-2 py-1">
                        <Clock className="h-3 w-3" />{area.horarioAbertura} – {area.horarioFechamento}
                      </span>
                      {area.capacidade && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-md px-2 py-1">
                          <Users className="h-3 w-3" />{area.capacidade} pessoas
                        </span>
                      )}
                      {area.maxReservasPorDia && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-md px-2 py-1">
                          <Hash className="h-3 w-3" />{area.maxReservasPorDia}/dia
                        </span>
                      )}
                      {area.duracaoMaxMinutos && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-md px-2 py-1">
                          <AlarmClock className="h-3 w-3" />máx {fmtDuracao(area.duracaoMaxMinutos)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── View: Agenda ── */}
      {view === "agenda" && areaAtiva && (
        <div className="px-4 py-4 space-y-4">

          {/* Calendário */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <button onClick={() => navMes(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold">{labelMes(mes)}</span>
              <button onClick={() => navMes(1)} className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 border-b">
              {DIAS.map((d) => (
                <div key={d} className="py-2 text-center text-[11px] font-medium text-muted-foreground">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {diasNoMes().map((dia, i) => (
                <button
                  key={i}
                  disabled={!dia.data || dia.data < hoje}
                  onClick={() => dia.data && setDataAtiva(dia.data)}
                  className={cn(
                    "aspect-square flex flex-col items-center justify-center text-sm relative transition-colors",
                    !dia.data && "invisible",
                    dia.data && dia.data < hoje && "text-muted-foreground/40 cursor-not-allowed",
                    dia.data && dia.data >= hoje && "hover:bg-muted cursor-pointer",
                    dataAtiva === dia.data && "bg-primary text-primary-foreground hover:bg-primary",
                    dia.data === hoje && dataAtiva !== hoje && "font-bold text-primary",
                  )}
                >
                  {dia.data?.slice(-2).replace(/^0/, "")}
                  {dia.temReserva && dataAtiva !== dia.data && dia.data && dia.data >= hoje && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary/60" />
                  )}
                </button>
              ))}
            </div>

            <div className="px-4 py-3 border-t flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary/60" /> Com reservas
              </span>
            </div>
          </Card>

          {/* Slots */}
          {!dataAtiva ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <CalendarClock className="h-7 w-7 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Selecione um dia no calendário</p>
            </div>
          ) : (
            <>
              {/* Cabeçalho */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold capitalize">
                  {new Date(dataAtiva + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "long", day: "numeric", month: "long"
                  })}
                </h2>
                {limiteAtingido && (
                  <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 font-medium">
                    Limite atingido
                  </span>
                )}
              </div>

              {/* Grid de slots */}
              {loadingSlots ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-[72px] rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum horário configurado para esta área.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {slots.map((slot) => {
                    const podeReservar    = slot.disponivel && !limiteAtingido
                    const r               = slot.reserva
                    const isMinha         = r?.minha ?? false
                    const reservaCompleta = isMinha ? reservasMes.find((rv) => rv.id === r?.id) : null

                    return slot.disponivel ? (
                      /* Livre */
                      <button
                        key={slot.horaInicio}
                        disabled={!podeReservar}
                        onClick={() => abrirModalReserva(slot)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-all",
                          podeReservar
                            ? "border-green-200 bg-green-50/60 hover:bg-green-50 hover:border-green-300 cursor-pointer"
                            : "border-amber-200 bg-amber-50/30 cursor-not-allowed"
                        )}
                      >
                        <p className="text-xs font-semibold tabular-nums text-foreground">
                          {slot.horaInicio} – {slot.horaFim}
                        </p>
                        <p className={cn("text-xs mt-1 font-medium flex items-center gap-1",
                          podeReservar ? "text-green-700" : "text-amber-600"
                        )}>
                          {podeReservar
                            ? <><span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />Disponível</>
                            : <><Lock className="h-3 w-3 shrink-0" />Limite atingido</>
                          }
                        </p>
                      </button>
                    ) : r ? (
                      /* Ocupado */
                      <div
                        key={slot.horaInicio}
                        className={cn(
                          "rounded-xl border p-3",
                          isMinha && reservaCompleta?.status === "CONFIRMADA" && "bg-primary/5 border-primary/20",
                          isMinha && reservaCompleta?.status === "PENDENTE"   && "bg-amber-50 border-amber-200",
                          isMinha && reservaCompleta?.status === "CANCELADA"  && "bg-muted border-border opacity-60",
                          !isMinha && "bg-muted/50 border-border",
                        )}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <p className="text-xs font-semibold tabular-nums text-foreground">
                            {slot.horaInicio} – {slot.horaFim}
                          </p>
                          {isMinha && reservaCompleta?.status === "PENDENTE" && (
                            <button
                              onClick={() => handleCancelar(reservaCompleta.id)}
                              className="text-[9px] text-red-600 border border-red-200 bg-red-50 rounded px-1.5 py-0.5 font-medium hover:bg-red-100 transition-colors shrink-0"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                        <p className="text-xs font-medium text-foreground truncate">
                          {isMinha ? "Minha reserva" : "Ocupado"}
                        </p>
                        <div className="flex items-center justify-between gap-1 mt-1">
                          <p className="text-[10px] text-muted-foreground truncate">
                            {isMinha ? (reservaCompleta?.observacao ?? "") : ""}
                          </p>
                          {isMinha && reservaCompleta && (
                            <span className={cn(
                              "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-medium shrink-0",
                              STATUS_CONFIG[reservaCompleta.status].color
                            )}>
                              {STATUS_CONFIG[reservaCompleta.status].icon}
                              {STATUS_CONFIG[reservaCompleta.status].label}
                            </span>
                          )}
                          {!isMinha && (
                            <Lock className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
                          )}
                        </div>
                      </div>
                    ) : null
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal: Confirmar reserva */}
      <Dialog open={modalReserva} onOpenChange={setModalReserva}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Solicitar reserva</DialogTitle>
          </DialogHeader>
          {slotSelecionado && areaAtiva && (
            <div className="space-y-4 py-1">
              <div className="rounded-xl bg-muted/50 border p-4 space-y-1.5 text-sm">
                <p className="font-semibold text-foreground">{areaAtiva.nome}</p>
                <p className="text-muted-foreground">
                  {dataAtiva && new Date(dataAtiva + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "long", day: "numeric", month: "long"
                  })}
                </p>
                <p className="font-medium text-foreground">
                  {slotSelecionado.horaInicio} – {slotSelecionado.horaFim}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obs">Observação <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  id="obs"
                  placeholder="Ex: Aniversário, reunião..."
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalReserva(false)}>Voltar</Button>
            <Button onClick={handleSalvarReserva} disabled={salvandoReserva}>
              {salvandoReserva && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Solicitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

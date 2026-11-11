import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

type Params = { params: Promise<{ id: string }> }

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

function fromMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * GET /api/areas/[id]/slots?data=YYYY-MM-DD
 * Retorna os slots de tempo da área para uma data, indicando disponibilidade.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const { id }          = await params
  const { searchParams } = new URL(req.url)
  const data             = searchParams.get("data") // YYYY-MM-DD

  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ message: "Parâmetro 'data' obrigatório (YYYY-MM-DD)" }, { status: 400 })
  }

  const area = await prisma.areaComum.findFirst({
    where: { id, condominioId: session.condominioId, ativa: true },
  })
  if (!area) return NextResponse.json({ message: "Área não encontrada" }, { status: 404 })

  // Busca reservas do dia (não canceladas)
  const dataInicio = new Date(`${data}T00:00:00.000Z`)
  const dataFim    = new Date(`${data}T23:59:59.999Z`)

  const reservasDoDia = await prisma.reserva.findMany({
    where: {
      areaId:      id,
      data:        { gte: dataInicio, lte: dataFim },
      status:      { not: "CANCELADA" },
    },
    include: {
      morador: { select: { id: true, nome: true, unidade: true } },
    },
    orderBy: { horaInicio: "asc" },
  })

  // Gera slots de 1h (ou duracaoMaxMinutos se menor) entre abertura e fechamento
  const intervalo   = area.duracaoMaxMinutos && area.duracaoMaxMinutos < 60 ? area.duracaoMaxMinutos : 60
  const abertura    = toMinutes(area.horarioAbertura)
  const fechamento  = toMinutes(area.horarioFechamento)

  const isStaff = ["SINDICO", "ADMIN", "PORTEIRO", "ZELADOR"].includes(session.role)

  const slots: Array<{
    horaInicio: string
    horaFim:    string
    disponivel: boolean
    reserva:    { id: string; status: string; morador: { id: string; nome: string; unidade: string | null } | null; minha: boolean } | null
  }> = []

  for (let inicio = abertura; inicio + intervalo <= fechamento; inicio += intervalo) {
    const fim     = inicio + intervalo
    const hInicio = fromMinutes(inicio)
    const hFim    = fromMinutes(fim)

    // Verifica se há sobreposição com alguma reserva existente
    const reservaOcupante = reservasDoDia.find((r) => {
      const rInicio = toMinutes(r.horaInicio)
      const rFim    = toMinutes(r.horaFim)
      return inicio < rFim && fim > rInicio
    })

    const minha = reservaOcupante?.morador.id === session.sub

    slots.push({
      horaInicio: hInicio,
      horaFim:    hFim,
      disponivel: !reservaOcupante,
      reserva:    reservaOcupante
        ? {
            id:      reservaOcupante.id,
            status:  reservaOcupante.status,
            // Morador só vê dados da própria reserva; staff vê todos
            morador: (isStaff || minha) ? reservaOcupante.morador : null,
            minha,
          }
        : null,
    })
  }

  // Contagem de reservas no dia (para validar maxReservasPorDia)
  const totalReservasDia = reservasDoDia.length

  return NextResponse.json({
    area: {
      id:                area.id,
      nome:              area.nome,
      horarioAbertura:   area.horarioAbertura,
      horarioFechamento: area.horarioFechamento,
      maxReservasPorDia: area.maxReservasPorDia,
      duracaoMaxMinutos: area.duracaoMaxMinutos,
    },
    data,
    slots,
    totalReservasDia,
    limiteAtingido: area.maxReservasPorDia != null && totalReservasDia >= area.maxReservasPorDia,
  })
}

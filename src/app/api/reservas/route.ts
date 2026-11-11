import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { criarNotificacaoZelador } from "@/lib/notificacao"
import { z } from "zod"

const createSchema = z.object({
  areaId:     z.string().uuid(),
  data:       z.string(), // ISO date "YYYY-MM-DD"
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  horaFim:    z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  observacao: z.string().optional().nullable(),
})

const includeRelations = {
  area:    { select: { id: true, nome: true } },
  morador: { select: { id: true, nome: true, unidade: true, bloco: true } },
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const areaId  = searchParams.get("areaId")
  const mes     = searchParams.get("mes")   // "YYYY-MM"
  const minhas  = searchParams.get("minhas") === "true"

  try {
    let dataInicio: Date | undefined
    let dataFim: Date | undefined

    if (mes) {
      const [ano, m] = mes.split("-").map(Number)
      dataInicio = new Date(ano, m - 1, 1)
      dataFim    = new Date(ano, m, 0, 23, 59, 59)
    }

    const reservas = await prisma.reserva.findMany({
      where: {
        condominioId: session.condominioId,
        ...(areaId  ? { areaId }              : {}),
        ...(minhas  ? { moradorId: session.sub } : {}),
        ...(dataInicio && dataFim ? { data: { gte: dataInicio, lte: dataFim } } : {}),
      },
      include: includeRelations,
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
    })

    return NextResponse.json({ reservas })
  } catch (error) {
    console.error("[GET /api/reservas]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
  }

  const { areaId, data, horaInicio, horaFim, observacao } = parsed.data

  if (horaInicio >= horaFim) {
    return NextResponse.json({ message: "Horário de início deve ser antes do fim" }, { status: 400 })
  }

  try {
    // Verifica se a área pertence ao condomínio e está ativa
    const area = await prisma.areaComum.findFirst({
      where: { id: areaId, condominioId: session.condominioId, ativa: true },
    })
    if (!area) return NextResponse.json({ message: "Área não encontrada" }, { status: 404 })

    const dataReserva = new Date(data + "T00:00:00")

    // ── Valida regras da área ──────────────────────────────────────────────────

    // Horário de funcionamento
    if (horaInicio < area.horarioAbertura) {
      return NextResponse.json(
        { message: `Esta área só abre a partir das ${area.horarioAbertura}` },
        { status: 400 }
      )
    }
    if (horaFim > area.horarioFechamento) {
      return NextResponse.json(
        { message: `Esta área fecha às ${area.horarioFechamento}` },
        { status: 400 }
      )
    }

    // Duração máxima
    if (area.duracaoMaxMinutos != null) {
      const [hI, mI] = horaInicio.split(":").map(Number)
      const [hF, mF] = horaFim.split(":").map(Number)
      const duracao  = (hF * 60 + mF) - (hI * 60 + mI)
      if (duracao > area.duracaoMaxMinutos) {
        const horas = Math.floor(area.duracaoMaxMinutos / 60)
        const mins  = area.duracaoMaxMinutos % 60
        const label = horas > 0 ? `${horas}h${mins > 0 ? mins + "min" : ""}` : `${mins}min`
        return NextResponse.json(
          { message: `Duração máxima permitida é ${label}` },
          { status: 400 }
        )
      }
    }

    // Máximo de reservas por dia
    if (area.maxReservasPorDia != null) {
      const totalDia = await prisma.reserva.count({
        where: {
          areaId,
          data:   dataReserva,
          status: { not: "CANCELADA" },
        },
      })
      if (totalDia >= area.maxReservasPorDia) {
        return NextResponse.json(
          { message: `Limite de ${area.maxReservasPorDia} reserva(s) por dia atingido para esta área` },
          { status: 409 }
        )
      }
    }

    // Verifica conflito de horário
    const conflito = await prisma.reserva.findFirst({
      where: {
        areaId,
        data: dataReserva,
        status: { not: "CANCELADA" },
        AND: [
          { horaInicio: { lt: horaFim } },
          { horaFim:    { gt: horaInicio } },
        ],
      },
    })

    if (conflito) {
      return NextResponse.json(
        { message: `Horário conflita com reserva das ${conflito.horaInicio} às ${conflito.horaFim}` },
        { status: 409 }
      )
    }

    const reserva = await prisma.reserva.create({
      data: {
        condominioId: session.condominioId,
        areaId,
        moradorId:    session.sub,
        data:         dataReserva,
        horaInicio,
        horaFim,
        observacao:   observacao ?? null,
        // Síndico/admin confirma automaticamente
        status: ["SINDICO", "ADMIN", "PORTEIRO"].includes(session.role) ? "CONFIRMADA" : "PENDENTE",
      },
      include: includeRelations,
    })

    if (session.role === "ZELADOR" || session.role === "PORTEIRO") {
      const dataFmt = new Date(data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
      await criarNotificacaoZelador({
        condominioId: session.condominioId,
        titulo:       `Nova reserva criada`,
        descricao:    `${session.nome} reservou ${area.nome} em ${dataFmt} das ${horaInicio} às ${horaFim}`,
        link:         "/reservas",
        autorNome:    session.nome,
      })
    }

    return NextResponse.json(reserva, { status: 201 })
  } catch (error) {
    console.error("[POST /api/reservas]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

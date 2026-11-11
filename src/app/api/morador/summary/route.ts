import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const { condominioId, sub: moradorId } = session
  // Início do dia atual — comunicado com expiraEm = hoje ainda é visível
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  try {
    // Busca bloco/unidade do morador para filtrar comunicados por targeting
    const morador = await prisma.usuario.findUnique({
      where: { id: moradorId },
      select: { bloco: true, unidade: true },
    })

    // Filtro de targeting: morador vê TODOS + comunicados do seu bloco/unidade
    const targetingOrClauses: object[] = [{ destinatario: "TODOS" as const }]
    if (morador?.bloco)   targetingOrClauses.push({ destinatario: "BLOCOS"   as const, blocos:   { has: morador.bloco } })
    if (morador?.unidade) targetingOrClauses.push({ destinatario: "UNIDADES" as const, unidades: { has: morador.unidade } })

    const comunicadosWhere = {
      condominioId,
      publicado: true,
      arquivado: false,
      OR: [
        { expiraEm: null },
        { expiraEm: { gte: hoje } },
      ],
      AND: [{ OR: targetingOrClauses }],
    }

    const [
      reservasAtivas,
      comunicadosPublicados,
      chamadosAbertos,
      entregasAguardando,
      proximasReservas,
      ultimosComunicados,
    ] = await Promise.all([
      // Reservas ativas do morador
      prisma.reserva.count({
        where: {
          condominioId,
          moradorId,
          status: { not: "CANCELADA" },
          data: { gte: hoje },
        },
      }),

      // Comunicados visíveis para este morador
      prisma.comunicado.count({ where: comunicadosWhere }),

      // Chamados abertos do morador
      prisma.chamado.count({
        where: {
          condominioId,
          moradorId,
          status: { in: ["ABERTO", "EM_ANDAMENTO", "AGUARDANDO_PRESTADOR"] },
        },
      }),

      // Entregas aguardando retirada
      prisma.encomenda.count({
        where: { condominioId, destinatarioId: moradorId, status: "AGUARDANDO" },
      }),

      // Próximas 3 reservas do morador
      prisma.reserva.findMany({
        where: {
          condominioId,
          moradorId,
          status: { not: "CANCELADA" },
          data: { gte: hoje },
        },
        orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
        take: 3,
        include: { area: { select: { id: true, nome: true } } },
      }),

      // Últimos 3 comunicados visíveis para este morador
      prisma.comunicado.findMany({
        where: comunicadosWhere,
        orderBy: [{ fixado: "desc" }, { createdAt: "desc" }],
        take: 3,
        select: { id: true, titulo: true, tipo: true, fixado: true, createdAt: true, expiraEm: true },
      }),
    ])

    return NextResponse.json({
      stats: { reservasAtivas, comunicadosPublicados, chamadosAbertos, entregasAguardando },
      proximasReservas: proximasReservas.map((r) => ({
        id: r.id, data: r.data, horaInicio: r.horaInicio,
        horaFim: r.horaFim, status: r.status, area: r.area,
      })),
      ultimosComunicados,
    })
  } catch (error) {
    console.error("[GET /api/morador/summary]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

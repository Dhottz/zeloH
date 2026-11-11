import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const condominioId = session.condominioId
  const agora = new Date()
  const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0)
  const fimDia    = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999)
  const proximos7Dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const [
    ocorrenciasAbertas,
    encomendasHoje,
    ultimosChamados,
    proximasManutencoes,
  ] = await Promise.all([
    // Ocorrências abertas
    prisma.chamado.count({
      where: {
        condominioId,
        status: { in: ["ABERTO", "EM_ANDAMENTO", "AGUARDANDO_PRESTADOR"] },
      },
    }),

    // Encomendas hoje (documentos do tipo "ENTREGA" criados hoje)
    prisma.documento.count({
      where: {
        condominioId,
        tipo: "ENTREGA",
        createdAt: { gte: inicioDia, lte: fimDia },
      },
    }),

    // Últimas ocorrências
    prisma.chamado.findMany({
      where: { condominioId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        morador: { select: { nome: true, unidade: true } },
      },
    }),

    // Próximas manutenções agendadas
    prisma.manutencaoHistorico.findMany({
      where: {
        condominioId,
        status: { in: ["OPEN", "IN_PROGRESS", "PENDING"] },
        agendadoEm: { gte: inicioDia },
      },
      orderBy: { agendadoEm: "asc" },
      take: 5,
    }),
  ])

  return NextResponse.json({
    metricas: {
      ocorrenciasAbertas,
      encomendasHoje,
      manutencoesVencendo: proximasManutencoes.length,
    },
    ultimosChamados: ultimosChamados.map((c) => ({
      id: c.id,
      titulo: c.titulo,
      status: c.status,
      prioridade: c.prioridade,
      createdAt: c.createdAt,
      morador: c.morador.nome,
      unidade: c.morador.unidade,
    })),
    proximasManutencoes: proximasManutencoes.map((m) => ({
      id: m.id,
      titulo: m.titulo,
      agendadoEm: m.agendadoEm,
      prestadorNome: m.prestadorNome,
      status: m.status,
    })),
  })
}

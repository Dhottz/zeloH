import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { itensDeAtencao } from "@/lib/atencao"
import { STATUS_ABERTOS } from "@/lib/preventiva"
import { podeVerFinanceiro } from "@/lib/permissions"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (session.role === "MORADOR") return NextResponse.json({ message: "Sem permissão" }, { status: 403 })

  const condominioId = session.condominioId
  const agora = new Date()
  const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0)
  const fimDia    = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999)
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const em7dias   = new Date(inicioDia.getTime() + 8 * 86_400_000)

  const [
    ocorrenciasAbertas, encomendasHoje, encomendasAguardando, reservasPendentes,
    ultimosChamados, proximasManutencoes, manutencoesAtrasadas, despesasMes, atencao,
  ] = await Promise.all([
    prisma.chamado.count({
      where: { condominioId, status: { in: ["ABERTO", "EM_ANDAMENTO", "AGUARDANDO_PRESTADOR"] } },
    }),
    prisma.encomenda.count({ where: { condominioId, createdAt: { gte: inicioDia, lte: fimDia } } }),
    prisma.encomenda.count({ where: { condominioId, status: "AGUARDANDO" } }),
    prisma.reserva.count({ where: { condominioId, status: "PENDENTE", data: { gte: inicioDia } } }),
    prisma.chamado.findMany({
      where: { condominioId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { morador: { select: { nome: true, unidade: true } } },
    }),
    prisma.manutencaoHistorico.findMany({
      where: { condominioId, status: { in: STATUS_ABERTOS }, agendadoEm: { gte: inicioDia, lt: em7dias } },
      orderBy: { agendadoEm: "asc" },
      take: 6,
      include: { equipamento: { select: { nome: true } } },
    }),
    prisma.manutencaoHistorico.count({
      where: { condominioId, status: { in: STATUS_ABERTOS }, agendadoEm: { lt: inicioDia } },
    }),
    podeVerFinanceiro(session.role)
      ? prisma.despesa.aggregate({
          where: { condominioId, status: { in: ["APROVADA", "PAGA"] }, competencia: { gte: inicioMes } },
          _sum: { valor: true },
        })
      : Promise.resolve(null),
    itensDeAtencao(condominioId),
  ])

  return NextResponse.json({
    metricas: {
      ocorrenciasAbertas,
      encomendasHoje,
      encomendasAguardando,
      reservasPendentes,
      manutencoesSemana: proximasManutencoes.length,
      manutencoesAtrasadas,
      despesasMes: despesasMes ? Number(despesasMes._sum.valor ?? 0) : null,
      // compatibilidade com telas antigas
      manutencoesVencendo: proximasManutencoes.length,
    },
    atencao,
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
      equipamento: m.equipamento?.nome ?? null,
      tipo: m.tipo,
      status: m.status,
    })),
  })
}

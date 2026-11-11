import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { podeOperar } from "@/lib/permissions"
import { criarNotificacaoZelador, notificarUsuarios } from "@/lib/notificacao"
import { registrarAuditoria } from "@/lib/auditoria"
import { exigirModulo } from "@/lib/api"
import { checklistDeLista, STATUS_ABERTOS, MANUTENCAO_INCLUDE } from "@/lib/preventiva"
import type { Prisma } from "@/generated/prisma/client"
import { z } from "zod"

const createSchema = z.object({
  titulo:        z.string().min(3, "Título obrigatório"),
  descricao:     z.string().optional().nullable(),
  status:        z.enum(["OPEN", "IN_PROGRESS", "PENDING", "COMPLETED", "CANCELLED"]).default("OPEN"),
  prioridade:    z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  tipo:          z.enum(["PREVENTIVA", "CORRETIVA"]).default("CORRETIVA"),
  empresaNome:   z.string().optional().nullable(),
  prestadorNome: z.string().optional().nullable(),
  prestadorCnpj: z.string().optional().nullable(),
  prestadorId:   z.string().uuid().optional().nullable(),
  equipamentoId: z.string().uuid().optional().nullable(),
  chamadoId:     z.string().uuid().optional().nullable(),
  valor:         z.number().optional().nullable(),
  agendadoEm:    z.string().optional().nullable(),
  local:         z.string().optional().nullable(),
  observacoes:   z.string().optional().nullable(),
  checklist:     z.array(z.string()).optional(),
  fotos:         z.array(z.string()).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  const condominioId = session.condominioId

  const { searchParams } = req.nextUrl
  const status        = searchParams.get("status")
  const prioridade    = searchParams.get("prioridade")
  const prestador     = searchParams.get("prestador") ?? ""
  const busca         = searchParams.get("busca") ?? ""
  const visivel       = searchParams.get("visivel")
  const tipo          = searchParams.get("tipo")
  const equipamentoId = searchParams.get("equipamentoId")
  const filtro        = searchParams.get("filtro") // atrasadas | orcamento
  const pagina        = Math.max(1, parseInt(searchParams.get("pagina") ?? "1"))
  const limite        = Math.min(100, parseInt(searchParams.get("limite") ?? "20"))
  const skip          = (pagina - 1) * limite
  const inicioHoje    = new Date(new Date().setHours(0, 0, 0, 0))

  const where: Prisma.ManutencaoHistoricoWhereInput = {
    condominioId,
    // Prestador só enxerga as ordens atribuídas à própria empresa
    ...(session.role === "PRESTADOR" ? { prestadorId: session.prestadorId ?? "__nenhum__" } : {}),
    ...(status        ? { status }     : {}),
    ...(prioridade    ? { prioridade } : {}),
    ...(tipo === "PREVENTIVA" || tipo === "CORRETIVA" ? { tipo } : {}),
    ...(equipamentoId ? { equipamentoId } : {}),
    ...(prestador     ? { prestadorNome: { contains: prestador, mode: "insensitive" } } : {}),
    ...(visivel === "true" || visivel === "false" ? { visivelParaMoradores: visivel === "true" } : {}),
    ...(filtro === "atrasadas" ? { status: { in: STATUS_ABERTOS }, agendadoEm: { lt: inicioHoje } } : {}),
    ...(filtro === "orcamento" ? { orcamentoStatus: "PENDENTE" } : {}),
    ...(busca ? {
      OR: [
        { titulo:        { contains: busca, mode: "insensitive" } },
        { empresaNome:   { contains: busca, mode: "insensitive" } },
        { prestadorNome: { contains: busca, mode: "insensitive" } },
        { local:         { contains: busca, mode: "insensitive" } },
        { equipamento:   { nome: { contains: busca, mode: "insensitive" } } },
      ],
    } : {}),
  }

  const base: Prisma.ManutencaoHistoricoWhereInput = {
    condominioId,
    ...(session.role === "PRESTADOR" ? { prestadorId: session.prestadorId ?? "__nenhum__" } : {}),
  }

  const [registros, total, abertas, atrasadas, orcamentosPendentes] = await Promise.all([
    prisma.manutencaoHistorico.findMany({
      where,
      include: MANUTENCAO_INCLUDE,
      orderBy: [{ agendadoEm: "asc" }, { createdAt: "desc" }],
      take: limite,
      skip,
    }),
    prisma.manutencaoHistorico.count({ where }),
    prisma.manutencaoHistorico.count({ where: { ...base, status: { in: STATUS_ABERTOS } } }),
    prisma.manutencaoHistorico.count({ where: { ...base, status: { in: STATUS_ABERTOS }, agendadoEm: { lt: inicioHoje } } }),
    prisma.manutencaoHistorico.count({ where: { ...base, orcamentoStatus: "PENDENTE" } }),
  ])

  return NextResponse.json({
    registros,
    total,
    pagina,
    limite,
    totalPaginas: Math.max(1, Math.ceil(total / limite)),
    resumo: { abertas, atrasadas, orcamentosPendentes },
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  if (!podeOperar(session.role)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  }
  const bloqueio = await exigirModulo(session.condominioId, "manutencoes")
  if (bloqueio) return bloqueio

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
  }
  const d = parsed.data

  // Valida vínculos com o mesmo condomínio
  const [prestador, equipamento] = await Promise.all([
    d.prestadorId ? prisma.prestador.findFirst({ where: { id: d.prestadorId, condominioId: session.condominioId } }) : null,
    d.equipamentoId ? prisma.equipamento.findFirst({ where: { id: d.equipamentoId, condominioId: session.condominioId } }) : null,
  ])
  if (d.prestadorId && !prestador) return NextResponse.json({ message: "Prestador não encontrado" }, { status: 404 })
  if (d.equipamentoId && !equipamento) return NextResponse.json({ message: "Equipamento não encontrado" }, { status: 404 })

  try {
    const manutencao = await prisma.manutencaoHistorico.create({
      data: {
        condominioId:  session.condominioId,
        titulo:        d.titulo,
        descricao:     d.descricao ?? null,
        status:        d.status,
        prioridade:    d.prioridade,
        tipo:          d.tipo,
        empresaNome:   d.empresaNome ?? prestador?.nome ?? null,
        prestadorNome: d.prestadorNome ?? prestador?.nome ?? null,
        prestadorCnpj: d.prestadorCnpj ?? prestador?.cnpj ?? null,
        prestadorId:   prestador?.id ?? null,
        equipamentoId: equipamento?.id ?? null,
        chamadoId:     d.chamadoId ?? null,
        valor:         d.valor ?? null,
        agendadoEm:    d.agendadoEm ? new Date(d.agendadoEm) : null,
        concluidoEm:   d.status === "COMPLETED" ? new Date() : null,
        local:         d.local ?? equipamento?.local ?? null,
        observacoes:   d.observacoes ?? null,
        checklist:     d.checklist?.length ? (checklistDeLista(d.checklist) as unknown as object) : undefined,
        fotos:         d.fotos ?? [],
        origem:        "MANUAL",
        registradoPor: session.sub,
        visivelParaMoradores: false,
      },
      include: MANUTENCAO_INCLUDE,
    })

    if (session.role === "ZELADOR") {
      await criarNotificacaoZelador({
        condominioId: session.condominioId,
        titulo:       `Nova manutenção registrada`,
        descricao:    `${session.nome} registrou: ${d.titulo}`,
        link:         "/manutencoes",
        autorNome:    session.nome,
      })
    }

    // Avisa os usuários do prestador atribuído
    if (prestador) {
      const usuarios = await prisma.usuario.findMany({
        where: { prestadorId: prestador.id, isActive: true, condominioId: session.condominioId },
        select: { id: true },
      })
      await notificarUsuarios({
        condominioId: session.condominioId,
        usuarioIds:   usuarios.map((u) => u.id),
        titulo:       `Nova ordem de serviço: ${d.titulo}`,
        descricao:    d.agendadoEm ? `Agendada para ${new Date(d.agendadoEm).toLocaleDateString("pt-BR")}.` : undefined,
        link:         "/manutencoes",
      })
    }

    await registrarAuditoria(session, "CRIAR", "Manutencao", manutencao.id, `Registrou manutenção "${d.titulo}"`)

    return NextResponse.json(manutencao, { status: 201 })
  } catch (error) {
    console.error("[POST /api/manutencoes]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

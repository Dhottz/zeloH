import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { criarNotificacaoZelador } from "@/lib/notificacao"
import { z } from "zod"

const createSchema = z.object({
  titulo:       z.string().min(3, "Título obrigatório"),
  descricao:    z.string().optional().nullable(),
  status:       z.enum(["OPEN", "IN_PROGRESS", "PENDING", "COMPLETED", "CANCELLED"]).default("OPEN"),
  prioridade:   z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  empresaNome:  z.string().optional().nullable(),
  prestadorNome: z.string().optional().nullable(),
  prestadorCnpj: z.string().optional().nullable(),
  valor:        z.number().optional().nullable(),
  agendadoEm:   z.string().optional().nullable(),
  local:        z.string().optional().nullable(),
  observacoes:  z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.sub },
    select: { condominioId: true },
  })
  if (!usuario?.condominioId) {
    return NextResponse.json({ message: "Condomínio não encontrado" }, { status: 404 })
  }

  const { searchParams } = req.nextUrl
  const status     = searchParams.get("status")
  const prioridade = searchParams.get("prioridade")
  const prestador  = searchParams.get("prestador") ?? ""
  const busca      = searchParams.get("busca") ?? ""
  const visivel    = searchParams.get("visivel")        // true | false
  const pagina     = Math.max(1, parseInt(searchParams.get("pagina") ?? "1"))
  const limite     = Math.min(50, parseInt(searchParams.get("limite") ?? "20"))
  const skip       = (pagina - 1) * limite

  const where = {
    condominioId: usuario.condominioId,
    ...(status     ? { status }     : {}),
    ...(prioridade ? { prioridade } : {}),
    ...(prestador  ? { prestadorNome: { contains: prestador, mode: "insensitive" as const } } : {}),
    ...(visivel !== null ? { visivelParaMoradores: visivel === "true" } : {}),
    ...(busca ? {
      OR: [
        { titulo:      { contains: busca, mode: "insensitive" as const } },
        { empresaNome: { contains: busca, mode: "insensitive" as const } },
        { prestadorNome: { contains: busca, mode: "insensitive" as const } },
        { local:       { contains: busca, mode: "insensitive" as const } },
      ],
    } : {}),
  }

  const [registros, total] = await Promise.all([
    prisma.manutencaoHistorico.findMany({
      where,
      orderBy: [{ agendadoEm: "asc" }, { createdAt: "desc" }],
      take: limite,
      skip,
    }),
    prisma.manutencaoHistorico.count({ where }),
  ])

  return NextResponse.json({
    registros,
    total,
    pagina,
    limite,
    totalPaginas: Math.ceil(total / limite),
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  if (session.role !== "SINDICO" && session.role !== "ADMIN" && session.role !== "ZELADOR") {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const manutencao = await prisma.manutencaoHistorico.create({
      data: {
        condominioId:  session.condominioId,
        titulo:        parsed.data.titulo,
        descricao:     parsed.data.descricao ?? null,
        status:        parsed.data.status,
        prioridade:    parsed.data.prioridade,
        empresaNome:   parsed.data.empresaNome ?? null,
        prestadorNome: parsed.data.prestadorNome ?? null,
        prestadorCnpj: parsed.data.prestadorCnpj ?? null,
        valor:         parsed.data.valor ?? null,
        agendadoEm:    parsed.data.agendadoEm ? new Date(parsed.data.agendadoEm) : null,
        local:         parsed.data.local ?? null,
        observacoes:   parsed.data.observacoes ?? null,
        origem:        "MANUAL",
        registradoPor: session.sub,
        visivelParaMoradores: false,
      },
    })

    if (session.role === "ZELADOR" || session.role === "PORTEIRO") {
      await criarNotificacaoZelador({
        condominioId: session.condominioId,
        titulo:       `Nova manutenção registrada`,
        descricao:    `${session.nome} registrou: ${parsed.data.titulo}`,
        link:         "/manutencoes",
        autorNome:    session.nome,
      })
    }

    return NextResponse.json(manutencao, { status: 201 })
  } catch (error) {
    console.error("[POST /api/manutencoes]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

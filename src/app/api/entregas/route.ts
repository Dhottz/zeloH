import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { criarNotificacaoZelador, notificarUsuarios } from "@/lib/notificacao"
import { serializarEncomenda } from "@/lib/encomendas"
import { z } from "zod"

const criarSchema = z.object({
  destinatarioId: z.string().uuid(),
  remetente:      z.string().optional(),
  descricao:      z.string().optional(),
  codigoRastreio: z.string().optional(),
  foto:           z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const pagina = Math.max(1, parseInt(searchParams.get("pagina") ?? "1"))
  const limite = 30

  // Morador vê só as próprias encomendas
  const where = {
    condominioId: session.condominioId,
    ...(session.role === "MORADOR" ? { destinatarioId: session.sub } : {}),
  }

  const inicioDia = new Date(new Date().setHours(0, 0, 0, 0))

  const [total, aguardandoCount, retiradasHoje, lista] = await Promise.all([
    prisma.encomenda.count({ where }),
    prisma.encomenda.count({ where: { ...where, status: "AGUARDANDO" } }),
    prisma.encomenda.count({ where: { ...where, status: "RETIRADA", retiradaEm: { gte: inicioDia } } }),
    prisma.encomenda.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (pagina - 1) * limite,
      take: limite,
    }),
  ])

  return NextResponse.json({
    entregas: lista.map(serializarEncomenda),
    totalPaginas: Math.max(1, Math.ceil(total / limite)),
    pagina,
    stats: { aguardando: aguardandoCount, retiradasHoje, total },
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (session.role === "MORADOR" || session.role === "PRESTADOR") {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { destinatarioId, remetente, descricao, codigoRastreio, foto } = criarSchema.parse(body)

    const destinatario = await prisma.usuario.findFirst({
      where: { id: destinatarioId, condominioId: session.condominioId },
    })
    if (!destinatario) return NextResponse.json({ message: "Morador não encontrado" }, { status: 404 })

    const encomenda = await prisma.encomenda.create({
      data: {
        condominioId:     session.condominioId,
        destinatarioId,
        destinatarioNome: destinatario.nome,
        unidade:          destinatario.unidade,
        bloco:            destinatario.bloco,
        remetente:        remetente?.trim() || null,
        descricao:        descricao?.trim() || null,
        codigoRastreio:   codigoRastreio?.trim() || null,
        foto:             foto ?? null,
        recebidaPor:      session.nome,
      },
    })

    // Aviso automático ao morador (app + push + e-mail)
    await notificarUsuarios({
      condominioId: session.condominioId,
      usuarioIds:   [destinatarioId],
      titulo:       "📦 Chegou uma encomenda para você",
      descricao:    `${remetente ? `De: ${remetente}. ` : ""}Retire na portaria.`,
      link:         "/morador/encomendas",
    })

    if (session.role === "ZELADOR" || session.role === "PORTEIRO") {
      await criarNotificacaoZelador({
        condominioId: session.condominioId,
        titulo:       `Nova entrega registrada`,
        descricao:    `${session.nome} registrou entrega para ${destinatario.nome}`,
        link:         "/entregas",
        autorNome:    session.nome,
      })
    }

    return NextResponse.json(serializarEncomenda(encomenda), { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Dados inválidos" }, { status: 400 })
    }
    console.error("[POST /api/entregas]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

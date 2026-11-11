import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { criarNotificacaoZelador } from "@/lib/notificacao"
import { z } from "zod"

const criarSchema = z.object({
  destinatarioId: z.string().uuid(),
  remetente:      z.string().optional(),
  descricao:      z.string().optional(),
})

/** Parseia o conteudo JSON de uma entrega, com fallback para registros antigos (sem conteudo). */
function parseConteudo(doc: { nome: string; conteudo: string | null }) {
  if (doc.conteudo) {
    try { return JSON.parse(doc.conteudo) } catch { /* fallback */ }
  }
  // Registro antigo: extrai remetente do campo nome ("Destinatário · Remetente")
  const partes     = doc.nome.replace(/^RETIRADO:\s*/i, "").split(" · ")
  const remetente  = partes[1] ?? ""
  const retiradaEm = doc.nome.startsWith("RETIRADO:") ? null : null // sem timestamp nos antigos
  return { remetente, descricao: null, unidade: null, retiradaEm, retiradoPor: null }
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const pagina = Math.max(1, parseInt(searchParams.get("pagina") ?? "1"))
  const limite = 30

  const agora      = new Date()
  const inicioDia  = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0)

  const [total, aguardandoCount, retiradasHoje, docs] = await Promise.all([
    prisma.documento.count({
      where: { condominioId: session.condominioId, tipo: "ENTREGA" },
    }),
    prisma.documento.count({
      where: {
        condominioId: session.condominioId,
        tipo: "ENTREGA",
        NOT: { nome: { startsWith: "RETIRADO:" } },
      },
    }),
    prisma.documento.count({
      where: {
        condominioId: session.condominioId,
        tipo: "ENTREGA",
        nome: { startsWith: "RETIRADO:" },
        updatedAt: { gte: inicioDia },
      },
    }),
    prisma.documento.findMany({
      where: { condominioId: session.condominioId, tipo: "ENTREGA" },
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * limite,
      take: limite,
    }),
  ])

  const entregas = docs.map((doc) => {
    const retirada   = doc.nome.startsWith("RETIRADO:")
    const nomeBase   = doc.nome.replace(/^RETIRADO:\s*/i, "")
    const destNome   = nomeBase.split(" · ")[0] ?? nomeBase
    const extra      = parseConteudo(doc)

    return {
      id:             doc.id,
      destNome,
      destinatarioId: extra.destinatarioId ?? null,
      remetente:      extra.remetente  ?? "",
      descricao:      extra.descricao  ?? null,
      unidade:        extra.unidade    ?? null,
      retirada,
      retiradaEm:     extra.retiradaEm ?? null,
      retiradoPor:    extra.retiradoPor ?? null,
      createdAt:      doc.createdAt,
    }
  })

  return NextResponse.json({
    entregas,
    totalPaginas: Math.ceil(total / limite),
    pagina,
    stats: {
      aguardando:    aguardandoCount,
      retiradasHoje: retiradasHoje,
      total,
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  try {
    const body = await req.json()
    const { destinatarioId, remetente, descricao } = criarSchema.parse(body)

    const destinatario = await prisma.usuario.findFirst({
      where: { id: destinatarioId, condominioId: session.condominioId },
    })
    if (!destinatario) return NextResponse.json({ message: "Morador não encontrado" }, { status: 404 })

    const entrega = await prisma.documento.create({
      data: {
        condominioId: session.condominioId,
        nome:         remetente ? `${destinatario.nome} · ${remetente}` : destinatario.nome,
        tipo:         "ENTREGA",
        uploadadoPor: session.sub,
        tamanho:      0,
        conteudo:     JSON.stringify({
          destinatarioId: destinatarioId,
          remetente,
          descricao:   descricao ?? null,
          unidade:     destinatario.unidade ?? null,
          retiradaEm:  null,
          retiradoPor: null,
        }),
      },
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

    return NextResponse.json(entrega, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Dados inválidos" }, { status: 400 })
    }
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

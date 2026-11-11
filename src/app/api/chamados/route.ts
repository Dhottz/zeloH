import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { criarNotificacaoZelador } from "@/lib/notificacao"
import { z } from "zod"

const criarSchema = z.object({
  titulo:     z.string().min(3),
  descricao:  z.string().optional(),
  prioridade: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).default("MEDIA"),
  moradorId:  z.string().uuid().optional(), // opcional: moradores usam session.sub
})

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

    const minhas      = req.nextUrl.searchParams.get("minhas") === "true"
    const busca       = req.nextUrl.searchParams.get("busca") ?? ""
    const prioridade  = req.nextUrl.searchParams.get("prioridade") ?? ""
    const statusParam = req.nextUrl.searchParams.get("status")

    const rawChamados = await prisma.chamado.findMany({
      where: {
        condominioId: session.condominioId,
        ...(minhas ? { moradorId: session.sub } : {}),
        ...(busca ? { titulo: { contains: busca, mode: "insensitive" } } : {}),
        ...(prioridade ? { prioridade: prioridade as "BAIXA" | "MEDIA" | "ALTA" | "URGENTE" } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        morador: { select: { id: true, nome: true, unidade: true, bloco: true } },
      },
    })

    // Filter by status in JS to avoid Prisma enum filter issues
    const chamados = statusParam
      ? rawChamados.filter((c) => c.status === statusParam)
      : rawChamados.filter((c) => c.status !== "ARQUIVADO")

    const agrupado = {
      ABERTO:               chamados.filter((c) => c.status === "ABERTO"),
      EM_ANDAMENTO:         chamados.filter((c) => c.status === "EM_ANDAMENTO"),
      AGUARDANDO_PRESTADOR: chamados.filter((c) => c.status === "AGUARDANDO_PRESTADOR"),
      CONCLUIDO:            chamados.filter((c) => c.status === "CONCLUIDO"),
      CANCELADO:            chamados.filter((c) => c.status === "CANCELADO"),
    }

    return NextResponse.json({ chamados, agrupado })
  } catch (error) {
    console.error("[API/chamados GET]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = criarSchema.parse(body)

    // Morador cria chamado para si mesmo; sindico/zelador podem especificar moradorId
    const moradorId = parsed.moradorId ?? session.sub

    const chamado = await prisma.chamado.create({
      data: {
        titulo:       parsed.titulo,
        descricao:    parsed.descricao,
        prioridade:   parsed.prioridade,
        moradorId,
        condominioId: session.condominioId,
        status:       "ABERTO",
      },
      include: {
        morador: { select: { id: true, nome: true, unidade: true, bloco: true } },
      },
    })

    if (session.role === "ZELADOR" || session.role === "PORTEIRO") {
      await criarNotificacaoZelador({
        condominioId: session.condominioId,
        titulo:       `Novo chamado aberto`,
        descricao:    `${session.nome} abriu: ${parsed.titulo}`,
        link:         "/ocorrencias",
        autorNome:    session.nome,
      })
    }

    return NextResponse.json(chamado, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Dados inválidos", errors: error.issues }, { status: 400 })
    }
    console.error("[API/chamados POST]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

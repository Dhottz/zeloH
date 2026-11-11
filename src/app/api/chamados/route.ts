import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { criarNotificacaoZelador, notificarPainel } from "@/lib/notificacao"
import { z } from "zod"

const criarSchema = z.object({
  titulo:        z.string().min(3),
  descricao:     z.string().optional(),
  prioridade:    z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).default("MEDIA"),
  local:         z.string().optional().nullable(),
  fotos:         z.array(z.string()).max(6).default([]),
  equipamentoId: z.string().uuid().optional().nullable(),
  moradorId:     z.string().uuid().optional(), // opcional: moradores usam session.sub
})

const INCLUDE = {
  morador:     { select: { id: true, nome: true, unidade: true, bloco: true } },
  equipamento: { select: { id: true, nome: true } },
  manutencoes: { select: { id: true, titulo: true, status: true } },
} as const

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
    if (session.role === "PRESTADOR") return NextResponse.json({ message: "Sem permissão" }, { status: 403 })

    // Morador só enxerga os próprios chamados (dados de vizinhos são privados)
    const minhas      = session.role === "MORADOR" || req.nextUrl.searchParams.get("minhas") === "true"
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
      include: INCLUDE,
    })

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
  if (session.role === "PRESTADOR") return NextResponse.json({ message: "Sem permissão" }, { status: 403 })

  try {
    const body = await req.json()
    const parsed = criarSchema.parse(body)

    // Morador cria chamado para si mesmo; a equipe pode abrir em nome de um morador
    const moradorId = session.role === "MORADOR" ? session.sub : parsed.moradorId ?? session.sub
    if (moradorId !== session.sub) {
      const dono = await prisma.usuario.findFirst({ where: { id: moradorId, condominioId: session.condominioId } })
      if (!dono) return NextResponse.json({ message: "Morador não encontrado" }, { status: 404 })
    }
    const equipamento = parsed.equipamentoId
      ? await prisma.equipamento.findFirst({ where: { id: parsed.equipamentoId, condominioId: session.condominioId }, select: { id: true } })
      : null

    // Fotos só podem vir do storage deste condomínio
    const fotos = parsed.fotos.filter((f) => f.startsWith(`${session.condominioId}/`))

    const chamado = await prisma.chamado.create({
      data: {
        titulo:        parsed.titulo,
        descricao:     parsed.descricao,
        prioridade:    parsed.prioridade,
        local:         parsed.local ?? null,
        fotos,
        equipamentoId: equipamento?.id ?? null,
        moradorId,
        condominioId:  session.condominioId,
        status:        "ABERTO",
      },
      include: INCLUDE,
    })

    if (session.role === "MORADOR") {
      await notificarPainel({
        condominioId: session.condominioId,
        titulo:       `Nova ocorrência: ${parsed.titulo}`,
        descricao:    `${session.nome}${chamado.morador.unidade ? ` · Apto ${chamado.morador.unidade}` : ""}${fotos.length ? ` · ${fotos.length} foto(s)` : ""}`,
        link:         "/ocorrencias",
        autorNome:    session.nome,
      })
    } else if (session.role === "ZELADOR" || session.role === "PORTEIRO") {
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

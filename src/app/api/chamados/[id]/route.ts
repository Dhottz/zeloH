import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { criarNotificacaoZelador } from "@/lib/notificacao"
import { z } from "zod"

const STATUS_LABEL: Record<string, string> = {
  ABERTO:               "Aberto",
  EM_ANDAMENTO:         "Em andamento",
  AGUARDANDO_PRESTADOR: "Aguard. prestador",
  CONCLUIDO:            "Concluído",
  CANCELADO:            "Cancelado",
}

const updateSchema = z.object({
  status:     z.enum(["ABERTO", "EM_ANDAMENTO", "AGUARDANDO_PRESTADOR", "CONCLUIDO", "CANCELADO"]).optional(),
  prioridade: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).optional(),
  titulo:     z.string().min(3).optional(),
  descricao:  z.string().optional(),
  visttoOsId: z.string().optional(),
  visttoOsCod:z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const { id } = await params

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    // Garante que o chamado pertence ao condomínio da sessão
    const existente = await prisma.chamado.findFirst({
      where: { id, condominioId: session.condominioId },
    })
    if (!existente) return NextResponse.json({ message: "Não encontrado" }, { status: 404 })

    const atualizado = await prisma.chamado.update({
      where: { id },
      data: {
        ...data,
        resolvidoEm: data.status === "CONCLUIDO" ? new Date() : undefined,
      },
      include: {
        morador: { select: { id: true, nome: true, unidade: true } },
      },
    })

    if (session.role === "ZELADOR" || session.role === "PORTEIRO") {
      const statusDesc = data.status ? ` → ${STATUS_LABEL[data.status] ?? data.status}` : ""
      await criarNotificacaoZelador({
        condominioId: session.condominioId,
        titulo:       `Chamado atualizado`,
        descricao:    `${session.nome} atualizou: ${existente.titulo}${statusDesc}`,
        link:         "/ocorrencias",
        autorNome:    session.nome,
      })
    }

    return NextResponse.json(atualizado)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Dados inválidos" }, { status: 400 })
    }
    console.error("[API/chamados PATCH]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const { id } = await params

  const existente = await prisma.chamado.findFirst({
    where: { id, condominioId: session.condominioId },
  })
  if (!existente) return NextResponse.json({ message: "Não encontrado" }, { status: 404 })

  await prisma.chamado.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

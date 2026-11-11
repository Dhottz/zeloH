import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { criarNotificacaoZelador, notificarUsuarios, notificarPainel } from "@/lib/notificacao"
import { podeGerenciar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { z } from "zod"

const STATUS_LABEL: Record<string, string> = {
  ABERTO:               "Aberto",
  EM_ANDAMENTO:         "Em andamento",
  AGUARDANDO_PRESTADOR: "Aguardando prestador",
  CONCLUIDO:            "Concluído",
  CANCELADO:            "Cancelado",
}

// Campos da equipe (síndico, zelador, porteiro...)
const updateSchema = z.object({
  status:        z.enum(["ABERTO", "EM_ANDAMENTO", "AGUARDANDO_PRESTADOR", "CONCLUIDO", "CANCELADO"]).optional(),
  prioridade:    z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).optional(),
  titulo:        z.string().min(3).optional(),
  descricao:     z.string().optional(),
  local:         z.string().nullable().optional(),
  fotos:         z.array(z.string()).max(12).optional(),
  equipamentoId: z.string().uuid().nullable().optional(),
  visttoOsId:    z.string().optional(),
  visttoOsCod:   z.string().optional(),
})

// Campos do morador dono do chamado
const moradorSchema = z.object({
  status:              z.literal("CANCELADO").optional(),
  avaliacaoNota:       z.number().int().min(1).max(5).optional(),
  avaliacaoComentario: z.string().max(500).nullable().optional(),
  fotos:               z.array(z.string()).max(6).optional(),
})

const INCLUDE = {
  morador:     { select: { id: true, nome: true, unidade: true, bloco: true } },
  equipamento: { select: { id: true, nome: true } },
  manutencoes: { select: { id: true, titulo: true, status: true } },
} as const

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (session.role === "PRESTADOR") return NextResponse.json({ message: "Sem permissão" }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json()

    const existente = await prisma.chamado.findFirst({
      where: { id, condominioId: session.condominioId },
    })
    if (!existente) return NextResponse.json({ message: "Não encontrado" }, { status: 404 })

    // ── Morador: só o próprio chamado, só avaliação e fotos ──────────────────
    if (session.role === "MORADOR") {
      if (existente.moradorId !== session.sub) return NextResponse.json({ message: "Não encontrado" }, { status: 404 })
      const d = moradorSchema.parse(body)
      if (d.avaliacaoNota !== undefined && existente.status !== "CONCLUIDO") {
        return NextResponse.json({ message: "Avalie depois que o chamado for concluído" }, { status: 400 })
      }
      if (d.status === "CANCELADO" && existente.status !== "ABERTO") {
        return NextResponse.json({ message: "Só é possível cancelar enquanto o chamado está aberto" }, { status: 400 })
      }
      const fotos = d.fotos?.filter((f) => f.startsWith(`${session.condominioId}/`))
      const atualizado = await prisma.chamado.update({
        where: { id },
        data: { ...d, ...(fotos ? { fotos } : {}) },
        include: INCLUDE,
      })
      if (d.avaliacaoNota !== undefined) {
        await notificarPainel({
          condominioId: session.condominioId,
          titulo:       `Atendimento avaliado: ${"★".repeat(d.avaliacaoNota)}${"☆".repeat(5 - d.avaliacaoNota)}`,
          descricao:    `${existente.titulo}${d.avaliacaoComentario ? ` — "${d.avaliacaoComentario}"` : ""}`,
          link:         "/ocorrencias",
          autorNome:    session.nome,
        })
      }
      return NextResponse.json(atualizado)
    }

    // ── Equipe ───────────────────────────────────────────────────────────────
    const data = updateSchema.parse(body)
    if (data.equipamentoId) {
      const eq = await prisma.equipamento.findFirst({ where: { id: data.equipamentoId, condominioId: session.condominioId } })
      if (!eq) return NextResponse.json({ message: "Equipamento não encontrado" }, { status: 404 })
    }

    const mudouStatus = !!data.status && data.status !== existente.status
    const atualizado = await prisma.chamado.update({
      where: { id },
      data: {
        ...data,
        ...(mudouStatus ? { resolvidoEm: data.status === "CONCLUIDO" ? new Date() : null } : {}),
      },
      include: INCLUDE,
    })

    // Avisa o morador quando o andamento muda
    if (mudouStatus && existente.moradorId !== session.sub) {
      const concluido = data.status === "CONCLUIDO"
      await notificarUsuarios({
        condominioId: session.condominioId,
        usuarioIds:   [existente.moradorId],
        titulo:       concluido ? `✅ Sua ocorrência foi resolvida` : `Sua ocorrência: ${STATUS_LABEL[data.status!] ?? data.status}`,
        descricao:    concluido ? `"${existente.titulo}". Conte como foi o atendimento!` : `"${existente.titulo}"`,
        link:         "/morador/ocorrencias",
        email:        concluido || data.status === "CANCELADO",
      })
    }

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

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const { id } = await params

  const existente = await prisma.chamado.findFirst({
    where: { id, condominioId: session.condominioId },
  })
  if (!existente) return NextResponse.json({ message: "Não encontrado" }, { status: 404 })

  // Gestores excluem qualquer um; o morador só cancela o próprio enquanto ainda está aberto
  const donoAberto = existente.moradorId === session.sub && existente.status === "ABERTO"
  if (!podeGerenciar(session.role) && !donoAberto) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  }

  await prisma.chamado.delete({ where: { id } })
  await registrarAuditoria(session, "EXCLUIR", "Chamado", id, `Excluiu a ocorrência "${existente.titulo}"`)
  return NextResponse.json({ ok: true })
}

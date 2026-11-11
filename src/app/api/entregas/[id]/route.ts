import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { notificarUsuarios } from "@/lib/notificacao"
import { registrarAuditoria } from "@/lib/auditoria"
import { serializarEncomenda } from "@/lib/encomendas"

type Params = { params: Promise<{ id: string }> }

function equipe(role: string) {
  return role !== "MORADOR" && role !== "PRESTADOR"
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (!equipe(session.role)) return NextResponse.json({ message: "Sem permissão" }, { status: 403 })

  const { id } = await params
  const encomenda = await prisma.encomenda.findFirst({ where: { id, condominioId: session.condominioId } })
  if (!encomenda) return NextResponse.json({ message: "Não encontrada" }, { status: 404 })

  await prisma.encomenda.delete({ where: { id } })
  await registrarAuditoria(session, "EXCLUIR", "Encomenda", id, `Excluiu encomenda de ${encomenda.destinatarioNome}`)
  return NextResponse.json({ ok: true })
}

/**
 * PATCH — ações: "retirar" (registra quem retirou), "avisar" (reenvia notificação), "editar".
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (!equipe(session.role)) return NextResponse.json({ message: "Sem permissão" }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { acao } = body as { acao?: string }

  const encomenda = await prisma.encomenda.findFirst({ where: { id, condominioId: session.condominioId } })
  if (!encomenda) return NextResponse.json({ message: "Não encontrada" }, { status: 404 })

  if (acao === "retirar") {
    if (encomenda.status === "RETIRADA") {
      return NextResponse.json({ message: "Já foi marcada como retirada" }, { status: 400 })
    }
    const { retiradoPorNome } = body as { retiradoPorNome?: string }
    const atualizado = await prisma.encomenda.update({
      where: { id },
      data: {
        status: "RETIRADA",
        retiradaEm: new Date(),
        retiradoPor: session.sub,
        retiradoPorNome: retiradoPorNome?.trim() || encomenda.destinatarioNome,
      },
    })
    return NextResponse.json(serializarEncomenda(atualizado))
  }

  if (acao === "avisar") {
    if (!encomenda.destinatarioId) {
      return NextResponse.json({ message: "Encomenda sem morador vinculado" }, { status: 400 })
    }
    await notificarUsuarios({
      condominioId: session.condominioId,
      usuarioIds:   [encomenda.destinatarioId],
      titulo:       "📦 Lembrete: sua encomenda está na portaria",
      descricao:    `${encomenda.remetente ? `De: ${encomenda.remetente}. ` : ""}Recebida em ${encomenda.createdAt.toLocaleDateString("pt-BR")}.`,
      link:         "/morador/encomendas",
    })
    return NextResponse.json({ ok: true, mensagem: "Morador avisado." })
  }

  if (acao === "editar") {
    const { destinatarioId, remetente, descricao, retirada, foto, codigoRastreio } = body as {
      destinatarioId?: string
      remetente?: string
      descricao?: string
      retirada?: boolean
      foto?: string | null
      codigoRastreio?: string
    }

    const data: Record<string, unknown> = {
      remetente: remetente?.trim() || null,
      descricao: descricao?.trim() || null,
    }
    if (foto !== undefined) data.foto = foto
    if (codigoRastreio !== undefined) data.codigoRastreio = codigoRastreio?.trim() || null

    if (destinatarioId && destinatarioId !== encomenda.destinatarioId) {
      const dest = await prisma.usuario.findFirst({
        where: { id: destinatarioId, condominioId: session.condominioId },
        select: { nome: true, unidade: true, bloco: true },
      })
      if (dest) {
        data.destinatarioId = destinatarioId
        data.destinatarioNome = dest.nome
        data.unidade = dest.unidade
        data.bloco = dest.bloco
      }
    }

    if (retirada === true && encomenda.status !== "RETIRADA") {
      data.status = "RETIRADA"
      data.retiradaEm = new Date()
      data.retiradoPor = session.sub
    } else if (retirada === false && encomenda.status === "RETIRADA") {
      data.status = "AGUARDANDO"
      data.retiradaEm = null
      data.retiradoPor = null
      data.retiradoPorNome = null
    }

    const atualizado = await prisma.encomenda.update({ where: { id }, data })
    return NextResponse.json(serializarEncomenda(atualizado))
  }

  return NextResponse.json({ message: "Ação inválida" }, { status: 400 })
}

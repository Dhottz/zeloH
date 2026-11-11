import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const { id } = await params
  const entrega = await prisma.documento.findFirst({
    where: { id, condominioId: session.condominioId, tipo: "ENTREGA" },
  })
  if (!entrega) return NextResponse.json({ message: "Não encontrada" }, { status: 404 })

  await prisma.documento.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const { id }   = await params
  const body     = await req.json()
  const { acao } = body // "retirar" | "avisar" | "editar"

  const entrega = await prisma.documento.findFirst({
    where: { id, condominioId: session.condominioId, tipo: "ENTREGA" },
  })
  if (!entrega) return NextResponse.json({ message: "Não encontrada" }, { status: 404 })

  if (acao === "retirar") {
    if (entrega.nome.startsWith("RETIRADO:")) {
      return NextResponse.json({ message: "Já foi marcada como retirada" }, { status: 400 })
    }

    // Atualiza o conteudo JSON com timestamp de retirada
    let conteudo: Record<string, unknown> = {}
    if (entrega.conteudo) {
      try { conteudo = JSON.parse(entrega.conteudo) } catch { /* ignora */ }
    }
    conteudo.retiradaEm  = new Date().toISOString()
    conteudo.retiradoPor = session.sub

    const atualizado = await prisma.documento.update({
      where: { id },
      data: {
        nome:     `RETIRADO: ${entrega.nome}`,
        conteudo: JSON.stringify(conteudo),
      },
    })
    return NextResponse.json(atualizado)
  }

  if (acao === "avisar") {
    // TODO: integrar com sistema de notificações/chat interno
    return NextResponse.json({ ok: true, mensagem: "Notificação registrada." })
  }

  if (acao === "editar") {
    const { destinatarioId, remetente, descricao, retirada } = body as {
      destinatarioId?: string
      remetente?: string
      descricao?: string
      retirada?: boolean
    }

    let conteudo: Record<string, unknown> = {}
    if (entrega.conteudo) {
      try { conteudo = JSON.parse(entrega.conteudo) } catch { /* ignora */ }
    }

    // Destinatário
    let destNome = entrega.nome.replace(/^RETIRADO:\s*/i, "").split(" · ")[0]
    if (destinatarioId) {
      const dest = await prisma.usuario.findFirst({
        where: { id: destinatarioId, condominioId: session.condominioId },
        select: { nome: true, unidade: true },
      })
      if (dest) {
        destNome = dest.nome
        conteudo.destinatarioId = destinatarioId
        conteudo.unidade        = dest.unidade ?? null
      }
    }

    // Campos editáveis
    conteudo.remetente = remetente ?? ""
    conteudo.descricao = descricao ?? null

    // Status de retirada
    const eraRetirada = entrega.nome.startsWith("RETIRADO:")
    if (retirada === true && !eraRetirada) {
      conteudo.retiradaEm  = new Date().toISOString()
      conteudo.retiradoPor = session.sub
    } else if (retirada === false && eraRetirada) {
      conteudo.retiradaEm  = null
      conteudo.retiradoPor = null
    }

    const isRetirada = retirada !== undefined ? retirada : eraRetirada
    const prefixo    = isRetirada ? "RETIRADO: " : ""
    const novoNome   = remetente?.trim()
      ? `${prefixo}${destNome} · ${remetente.trim()}`
      : `${prefixo}${destNome}`

    await prisma.documento.update({
      where: { id },
      data: { nome: novoNome, conteudo: JSON.stringify(conteudo) },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ message: "Ação inválida" }, { status: 400 })
}

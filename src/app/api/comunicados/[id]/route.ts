import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { podeGerenciar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { notificarComunicado } from "@/lib/comunicados"
import { z } from "zod"

const updateSchema = z.object({
  titulo:       z.string().min(3).optional(),
  conteudo:     z.string().min(5).optional(),
  tipo:         z.enum(["GERAL", "URGENTE", "AVISO", "EVENTO"]).optional(),
  fixado:       z.boolean().optional(),
  publicado:    z.boolean().optional(),
  arquivado:    z.boolean().optional(),
  expiraEm:     z.string().optional().nullable(),
  destinatario: z.enum(["TODOS", "BLOCOS", "UNIDADES"]).optional(),
  blocos:       z.array(z.string()).optional(),
  unidades:     z.array(z.string()).optional(),
  publicarEm:   z.string().optional().nullable(),
  anexos:       z.array(z.string()).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  if (!podeGerenciar(session.role)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  }

  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const existe = await prisma.comunicado.findFirst({
      where: { id, condominioId: session.condominioId },
    })
    if (!existe) return NextResponse.json({ message: "Comunicado não encontrado" }, { status: 404 })

    const { expiraEm, publicarEm, destinatario, blocos, unidades, ...rest } = parsed.data

    // Limpa blocos/unidades conforme destinatario
    const dest = destinatario ?? existe.destinatario
    const blocosFinal   = dest === "BLOCOS"   ? (blocos   ?? existe.blocos).filter(Boolean)   : []
    const unidadesFinal = dest === "UNIDADES" ? (unidades ?? existe.unidades).filter(Boolean) : []

    const atualizado = await prisma.comunicado.update({
      where: { id },
      data: {
        ...rest,
        ...(destinatario !== undefined ? { destinatario, blocos: blocosFinal, unidades: unidadesFinal } : {}),
        ...(expiraEm !== undefined ? { expiraEm: expiraEm ? new Date(expiraEm) : null } : {}),
        ...(publicarEm !== undefined ? { publicarEm: publicarEm ? new Date(publicarEm) : null } : {}),
      },
      include: { autor: { select: { id: true, nome: true, role: true } } },
    })

    await notificarComunicado(atualizado)
    if (parsed.data.publicado && !existe.publicado) {
      await registrarAuditoria(session, "PUBLICAR", "Comunicado", id, `Publicou o comunicado "${existe.titulo}"`)
    }

    return NextResponse.json(atualizado)
  } catch (error) {
    console.error("[PATCH /api/comunicados/[id]]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  if (!podeGerenciar(session.role)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  }

  const { id } = await params

  try {
    const existe = await prisma.comunicado.findFirst({
      where: { id, condominioId: session.condominioId },
    })
    if (!existe) return NextResponse.json({ message: "Comunicado não encontrado" }, { status: 404 })

    await prisma.comunicado.delete({ where: { id } })
    await registrarAuditoria(session, "EXCLUIR", "Comunicado", id, `Excluiu o comunicado "${existe.titulo}"`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/comunicados/[id]]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

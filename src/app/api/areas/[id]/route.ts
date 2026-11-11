import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { z } from "zod"

const schema = z.object({
  nome:                z.string().min(2).optional(),
  descricao:           z.string().optional().nullable(),
  capacidade:          z.number().int().positive().optional().nullable(),
  ativa:               z.boolean().optional(),
  horarioAbertura:     z.string().regex(/^\d{2}:\d{2}$/).optional(),
  horarioFechamento:   z.string().regex(/^\d{2}:\d{2}$/).optional(),
  maxReservasPorDia:   z.number().int().positive().optional().nullable(),
  duracaoMaxMinutos:   z.number().int().positive().optional().nullable(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (session.role !== "SINDICO" && session.role !== "ADMIN") {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  }

  const { id } = await params
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const area = await prisma.areaComum.findFirst({
      where: { id, condominioId: session.condominioId },
    })
    if (!area) return NextResponse.json({ message: "Área não encontrada" }, { status: 404 })

    const atualizada = await prisma.areaComum.update({ where: { id }, data: parsed.data })
    return NextResponse.json(atualizada)
  } catch (error) {
    console.error("[PATCH /api/areas/[id]]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (session.role !== "SINDICO" && session.role !== "ADMIN") {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  }

  const { id } = await params

  try {
    const area = await prisma.areaComum.findFirst({
      where: { id, condominioId: session.condominioId },
    })
    if (!area) return NextResponse.json({ message: "Área não encontrada" }, { status: 404 })

    await prisma.areaComum.update({ where: { id }, data: { ativa: false } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/areas/[id]]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

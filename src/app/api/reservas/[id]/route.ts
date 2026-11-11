import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { podeGerenciar } from "@/lib/permissions"
import { z } from "zod"

const updateSchema = z.object({
  status:     z.enum(["PENDENTE", "CONFIRMADA", "CANCELADA"]).optional(),
  observacao: z.string().optional().nullable(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

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
    const reserva = await prisma.reserva.findFirst({
      where: { id, condominioId: session.condominioId },
    })
    if (!reserva) return NextResponse.json({ message: "Reserva não encontrada" }, { status: 404 })

    // Morador só pode cancelar a própria reserva
    if (session.role === "MORADOR") {
      if (reserva.moradorId !== session.sub) {
        return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
      }
      if (parsed.data.status && parsed.data.status !== "CANCELADA") {
        return NextResponse.json({ message: "Moradores só podem cancelar reservas" }, { status: 403 })
      }
    }

    const atualizada = await prisma.reserva.update({
      where: { id },
      data: parsed.data,
      include: {
        area:    { select: { id: true, nome: true } },
        morador: { select: { id: true, nome: true, unidade: true, bloco: true } },
      },
    })

    return NextResponse.json(atualizada)
  } catch (error) {
    console.error("[PATCH /api/reservas/[id]]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (!(podeGerenciar(session.role) || session.role === "PORTEIRO")) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  }

  const { id } = await params

  try {
    const reserva = await prisma.reserva.findFirst({
      where: { id, condominioId: session.condominioId },
    })
    if (!reserva) return NextResponse.json({ message: "Reserva não encontrada" }, { status: 404 })

    await prisma.reserva.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/reservas/[id]]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

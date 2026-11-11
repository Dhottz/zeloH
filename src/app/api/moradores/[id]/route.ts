import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { z } from "zod"

const updateSchema = z.object({
  nome:     z.string().min(2).optional(),
  email:    z.string().email().optional(),
  role:     z.enum(["MORADOR", "ZELADOR", "SINDICO"]).optional(),
  unidade:  z.string().optional().nullable(),
  bloco:    z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }

// PATCH /api/moradores/[id] — atualiza dados
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

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const alvo = await prisma.usuario.findFirst({
      where: { id, condominioId: session.condominioId },
    })

    if (!alvo) {
      return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 })
    }

    const atualizado = await prisma.usuario.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true, nome: true, email: true, role: true,
        unidade: true, bloco: true, telefone: true,
        isActive: true, primeiroAcesso: true, createdAt: true,
      },
    })

    return NextResponse.json(atualizado)
  } catch (error) {
    console.error("[PATCH /api/moradores/[id]]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

// DELETE /api/moradores/[id] — desativa (soft delete)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  if (session.role !== "SINDICO" && session.role !== "ADMIN") {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  }

  const { id } = await params

  // Impede desativar a si mesmo
  if (id === session.sub) {
    return NextResponse.json({ message: "Você não pode desativar sua própria conta" }, { status: 400 })
  }

  try {
    const alvo = await prisma.usuario.findFirst({
      where: { id, condominioId: session.condominioId },
    })

    if (!alvo) {
      return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 })
    }

    await prisma.usuario.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/moradores/[id]]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

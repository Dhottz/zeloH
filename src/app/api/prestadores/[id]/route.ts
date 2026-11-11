import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { z } from "zod"

const updateSchema = z.object({
  nome:          z.string().min(2).optional(),
  especialidade: z.string().optional().nullable(),
  cnpj:          z.string().optional().nullable(),
  cpf:           z.string().optional().nullable(),
  telefone:      z.string().optional().nullable(),
  email:         z.string().email().optional().nullable().or(z.literal("")).transform(v => v || null),
  observacoes:   z.string().optional().nullable(),
  ativo:         z.boolean().optional(),
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

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const existe = await prisma.prestador.findFirst({
      where: { id, condominioId: session.condominioId },
    })
    if (!existe) return NextResponse.json({ message: "Prestador não encontrado" }, { status: 404 })

    const data = { ...parsed.data }
    if (data.cnpj) data.cnpj = data.cnpj.replace(/\D/g, "")
    if (data.cpf)  data.cpf  = data.cpf.replace(/\D/g, "")

    const atualizado = await prisma.prestador.update({ where: { id }, data })
    return NextResponse.json(atualizado)
  } catch (error) {
    console.error("[PATCH /api/prestadores/[id]]", error)
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
    const existe = await prisma.prestador.findFirst({
      where: { id, condominioId: session.condominioId },
    })
    if (!existe) return NextResponse.json({ message: "Prestador não encontrado" }, { status: 404 })

    await prisma.prestador.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/prestadores/[id]]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

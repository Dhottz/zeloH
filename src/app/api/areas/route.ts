import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { z } from "zod"

const schema = z.object({
  nome:                z.string().min(2, "Nome obrigatório"),
  descricao:           z.string().optional().nullable(),
  capacidade:          z.number().int().positive().optional().nullable(),
  horarioAbertura:     z.string().regex(/^\d{2}:\d{2}$/).optional(),
  horarioFechamento:   z.string().regex(/^\d{2}:\d{2}$/).optional(),
  maxReservasPorDia:   z.number().int().positive().optional().nullable(),
  duracaoMaxMinutos:   z.number().int().positive().optional().nullable(),
})

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  try {
    const areas = await prisma.areaComum.findMany({
      where: { condominioId: session.condominioId },
      orderBy: { nome: "asc" },
    })
    return NextResponse.json({ areas })
  } catch (error) {
    console.error("[GET /api/areas]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (session.role !== "SINDICO" && session.role !== "ADMIN") {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const area = await prisma.areaComum.create({
      data: { ...parsed.data, condominioId: session.condominioId },
    })
    return NextResponse.json(area, { status: 201 })
  } catch (error) {
    console.error("[POST /api/areas]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

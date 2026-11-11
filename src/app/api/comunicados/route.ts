import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { z } from "zod"

const createSchema = z.object({
  titulo:       z.string().min(3, "Título obrigatório"),
  conteudo:     z.string().min(5, "Conteúdo obrigatório"),
  tipo:         z.enum(["GERAL", "URGENTE", "AVISO", "EVENTO"]).default("GERAL"),
  fixado:       z.boolean().default(false),
  expiraEm:     z.string().optional().nullable(),
  publicado:    z.boolean().default(false),
  destinatario: z.enum(["TODOS", "BLOCOS", "UNIDADES"]).default("TODOS"),
  blocos:       z.array(z.string()).default([]),
  unidades:     z.array(z.string()).default([]),
})

const autorSelect = { select: { id: true, nome: true, role: true } }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const tipo      = searchParams.get("tipo")
  const publicado = searchParams.get("publicado")
  const busca     = searchParams.get("busca") ?? ""

  // Início do dia de amanhã — comunicado expira ao final do seu dia, não no início
  const inicioDiaSeguinte = new Date()
  inicioDiaSeguinte.setDate(inicioDiaSeguinte.getDate() + 1)
  inicioDiaSeguinte.setHours(0, 0, 0, 0)

  try {
    // ── Auto-arquivar comunicados publicados expirados ──────────────────────
    if (session.role === "SINDICO" || session.role === "ADMIN") {
      await prisma.comunicado.updateMany({
        where: {
          condominioId: session.condominioId,
          arquivado: false,
          publicado: true,
          AND: [
            { expiraEm: { not: null } },
            { expiraEm: { lt: inicioDiaSeguinte } },
          ],
        },
        data: { arquivado: true, publicado: false },
      })
    }

    // ── Filtro de targeting para moradores ──────────────────────────────────
    let targetingFilter = {}

    if (session.role === "MORADOR") {
      const user = await prisma.usuario.findUnique({
        where: { id: session.sub },
        select: { bloco: true, unidade: true },
      })

      const orClauses: object[] = [{ destinatario: "TODOS" as const }]

      if (user?.bloco) {
        orClauses.push({ destinatario: "BLOCOS" as const, blocos: { has: user.bloco } })
      }
      if (user?.unidade) {
        orClauses.push({ destinatario: "UNIDADES" as const, unidades: { has: user.unidade } })
      }

      targetingFilter = { OR: orClauses }
    }

    // Moradores nunca veem arquivados
    const arquivadoFilter = session.role === "MORADOR" ? { arquivado: false } : {}

    const comunicados = await prisma.comunicado.findMany({
      where: {
        condominioId: session.condominioId,
        ...(tipo      ? { tipo: tipo as "GERAL" | "URGENTE" | "AVISO" | "EVENTO" } : {}),
        ...(publicado !== null ? { publicado: publicado === "true" } : {}),
        ...(busca ? {
          OR: [
            { titulo:   { contains: busca, mode: "insensitive" } },
            { conteudo: { contains: busca, mode: "insensitive" } },
          ],
        } : {}),
        ...targetingFilter,
        ...arquivadoFilter,
      },
      include: { autor: autorSelect },
      orderBy: [{ fixado: "desc" }, { createdAt: "desc" }],
    })

    return NextResponse.json({ comunicados })
  } catch (error) {
    console.error("[GET /api/comunicados]", error)
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

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
  }

  // Limpa blocos/unidades quando não são usados
  const { destinatario, blocos, unidades } = parsed.data
  const blocosFinal   = destinatario === "BLOCOS"   ? blocos.filter(Boolean)   : []
  const unidadesFinal = destinatario === "UNIDADES" ? unidades.filter(Boolean) : []

  try {
    const comunicado = await prisma.comunicado.create({
      data: {
        ...parsed.data,
        blocos:       blocosFinal,
        unidades:     unidadesFinal,
        expiraEm:     parsed.data.expiraEm ? new Date(parsed.data.expiraEm) : null,
        condominioId: session.condominioId,
        autorId:      session.sub,
      },
      include: { autor: autorSelect },
    })

    return NextResponse.json(comunicado, { status: 201 })
  } catch (error) {
    console.error("[POST /api/comunicados]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

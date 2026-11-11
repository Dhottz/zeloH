import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { z } from "zod"
import { randomUUID } from "crypto"
import { hashPassword } from "@/lib/auth"

const createSchema = z.object({
  nome:     z.string().min(2, "Nome obrigatório"),
  email:    z.string().email("E-mail inválido").optional().or(z.literal("")).transform(v => v || undefined),
  role:     z.enum(["MORADOR", "ZELADOR", "PORTEIRO", "SINDICO"]).default("MORADOR"),
  unidade:  z.string().optional().nullable(),
  bloco:    z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
})

// GET /api/moradores — lista com busca e filtro
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const busca  = searchParams.get("busca")  ?? ""
  const role   = searchParams.get("role")   ?? "todos"
  const status = searchParams.get("status") ?? "ativos"

  try {
    const moradores = await prisma.usuario.findMany({
      where: {
        condominioId: session.condominioId,
        role: role === "todos"
          ? { in: ["MORADOR", "ZELADOR", "PORTEIRO", "SINDICO"] }
          : (role as "MORADOR" | "ZELADOR" | "PORTEIRO" | "SINDICO"),
        isActive: status === "inativos" ? false : status === "todos" ? undefined : true,
        ...(busca
          ? {
              OR: [
                { nome:    { contains: busca, mode: "insensitive" } },
                { email:   { contains: busca, mode: "insensitive" } },
                { unidade: { contains: busca, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true, nome: true, email: true, role: true,
        unidade: true, bloco: true, telefone: true, isActive: true,
        primeiroAcesso: true, createdAt: true,
      },
      orderBy: [{ bloco: "asc" }, { unidade: "asc" }, { nome: "asc" }],
    })

    const totais = await prisma.usuario.groupBy({
      by: ["role"],
      where: {
        condominioId: session.condominioId,
        isActive: true,
        role: { in: ["MORADOR", "ZELADOR", "PORTEIRO", "SINDICO"] },
      },
      _count: { _all: true },
    })

    return NextResponse.json({ moradores, totais })
  } catch (error) {
    console.error("[GET /api/moradores]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

// POST /api/moradores — cria novo morador
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

  const { nome, email: emailRaw, role, unidade, bloco, telefone } = parsed.data

  // Se email não informado, gera placeholder único (sem acesso ao app)
  const email = emailRaw || `morador-${randomUUID()}@zeloh.internal`

  try {
    const existe = await prisma.usuario.findUnique({ where: { email: emailRaw ?? "" } })
    if (existe) {
      return NextResponse.json({ message: "E-mail já cadastrado" }, { status: 409 })
    }

    // Senha aleatória — morador define a própria no primeiro acesso
    const passwordHash = await hashPassword(randomUUID())

    const morador = await prisma.usuario.create({
      data: {
        nome, email, passwordHash, role,
        unidade:        unidade  ?? null,
        bloco:          bloco    ?? null,
        telefone:       telefone ?? null,
        condominioId:   session.condominioId,
        isActive:       true,
        primeiroAcesso: true,
      },
      select: {
        id: true, nome: true, email: true, role: true,
        unidade: true, bloco: true, telefone: true,
        isActive: true, primeiroAcesso: true, createdAt: true,
      },
    })

    return NextResponse.json(morador, { status: 201 })
  } catch (error) {
    console.error("[POST /api/moradores]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

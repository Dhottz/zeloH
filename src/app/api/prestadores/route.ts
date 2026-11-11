import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { z } from "zod"

const createSchema = z.object({
  nome:          z.string().min(2, "Nome obrigatório"),
  especialidade: z.string().optional().nullable(),
  cnpj:          z.string().optional().nullable(),
  cpf:           z.string().optional().nullable(),
  telefone:      z.string().optional().nullable(),
  email:         z.string().email("E-mail inválido").optional().or(z.literal("")).transform(v => v || undefined),
  observacoes:   z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const busca         = searchParams.get("busca")         ?? ""
  const especialidade = searchParams.get("especialidade") ?? ""
  const status        = searchParams.get("status")        ?? "ativos"

  try {
    const prestadores = await prisma.prestador.findMany({
      where: {
        condominioId: session.condominioId,
        ativo: status === "inativos" ? false : status === "todos" ? undefined : true,
        ...(especialidade ? { especialidade } : {}),
        ...(busca ? {
          OR: [
            { nome:     { contains: busca, mode: "insensitive" } },
            { email:    { contains: busca, mode: "insensitive" } },
            { telefone: { contains: busca, mode: "insensitive" } },
            { cnpj:     { contains: busca, mode: "insensitive" } },
          ],
        } : {}),
      },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    })

    const total  = await prisma.prestador.count({ where: { condominioId: session.condominioId } })
    const ativos = await prisma.prestador.count({ where: { condominioId: session.condominioId, ativo: true } })

    return NextResponse.json({ prestadores, total, ativos })
  } catch (error) {
    console.error("[GET /api/prestadores]", error)
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

  // Remove formatação do CNPJ/CPF
  const data = { ...parsed.data }
  if (data.cnpj) data.cnpj = data.cnpj.replace(/\D/g, "")
  if (data.cpf)  data.cpf  = data.cpf.replace(/\D/g, "")

  try {
    const prestador = await prisma.prestador.create({
      data: { ...data, condominioId: session.condominioId },
    })
    return NextResponse.json(prestador, { status: 201 })
  } catch (error) {
    console.error("[POST /api/prestadores]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

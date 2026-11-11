import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession, hashPassword } from "@/lib/auth"
import { podeGerenciar, ehSindico, ROLES_ATRIBUIVEIS, type Role } from "@/lib/permissions"
import { enviarConvite } from "@/lib/convite"
import { registrarAuditoria } from "@/lib/auditoria"
import { z } from "zod"
import { randomUUID } from "crypto"

const ROLES = ROLES_ATRIBUIVEIS as [Role, ...Role[]]

const createSchema = z.object({
  nome:        z.string().min(2, "Nome obrigatório"),
  email:       z.string().email("E-mail inválido").optional().or(z.literal("")).transform(v => v || undefined),
  role:        z.enum(ROLES).default("MORADOR"),
  unidade:     z.string().optional().nullable(),
  bloco:       z.string().optional().nullable(),
  telefone:    z.string().optional().nullable(),
  prestadorId: z.string().uuid().optional().nullable(),
  enviarConvite: z.boolean().default(true),
})

const SELECT = {
  id: true, nome: true, email: true, role: true,
  unidade: true, bloco: true, telefone: true, isActive: true,
  primeiroAcesso: true, createdAt: true, prestadorId: true,
  prestador: { select: { id: true, nome: true } },
} as const

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
        role: role === "todos" || !ROLES.includes(role as Role)
          ? { in: ROLES }
          : (role as Role),
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
      select: SELECT,
      orderBy: [{ bloco: "asc" }, { unidade: "asc" }, { nome: "asc" }],
    })

    const totais = await prisma.usuario.groupBy({
      by: ["role"],
      where: { condominioId: session.condominioId, isActive: true, role: { in: ROLES } },
      _count: { _all: true },
    })

    return NextResponse.json({ moradores, totais })
  } catch (error) {
    console.error("[GET /api/moradores]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

// POST /api/moradores — cria usuário (morador ou equipe) e envia o convite de acesso
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  if (!podeGerenciar(session.role)) {
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

  const { nome, email: emailRaw, role, unidade, bloco, telefone, prestadorId } = parsed.data

  // Só o síndico/administradora cria outros síndicos e subsíndicos
  if ((role === "SINDICO" || role === "SUBSINDICO") && !ehSindico(session.role)) {
    return NextResponse.json({ message: "Apenas o síndico pode cadastrar este perfil" }, { status: 403 })
  }

  if (role === "PRESTADOR") {
    if (!prestadorId) return NextResponse.json({ message: "Selecione o prestador vinculado" }, { status: 400 })
    const prestador = await prisma.prestador.findFirst({ where: { id: prestadorId, condominioId: session.condominioId } })
    if (!prestador) return NextResponse.json({ message: "Prestador não encontrado" }, { status: 404 })
  }

  // Se email não informado, gera placeholder único (sem acesso ao app)
  const email = emailRaw || `morador-${randomUUID()}@zeloh.internal`

  try {
    if (emailRaw && (await prisma.usuario.findUnique({ where: { email: emailRaw } }))) {
      return NextResponse.json({ message: "E-mail já cadastrado" }, { status: 409 })
    }

    // Senha aleatória — o usuário define a própria pelo link de convite
    const passwordHash = await hashPassword(randomUUID())

    const usuario = await prisma.usuario.create({
      data: {
        nome, email, passwordHash, role,
        unidade:        unidade  ?? null,
        bloco:          bloco    ?? null,
        telefone:       telefone ?? null,
        prestadorId:    role === "PRESTADOR" ? prestadorId : null,
        condominioId:   session.condominioId,
        isActive:       true,
        primeiroAcesso: true,
      },
      select: SELECT,
    })

    let conviteEnviado = false
    if (emailRaw && parsed.data.enviarConvite) {
      const condo = await prisma.condominio.findUnique({ where: { id: session.condominioId }, select: { nome: true } })
      conviteEnviado = (await enviarConvite(usuario, condo?.nome ?? "seu condomínio")).enviado
    }

    await registrarAuditoria(session, "CRIAR", "Usuario", usuario.id, `Cadastrou ${nome} (${role})`)

    return NextResponse.json({ ...usuario, conviteEnviado }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/moradores]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

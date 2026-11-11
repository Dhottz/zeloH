import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { podeGerenciar, ehSindico, ROLES_ATRIBUIVEIS, type Role } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { z } from "zod"

const ROLES = ROLES_ATRIBUIVEIS as [Role, ...Role[]]

const updateSchema = z.object({
  nome:        z.string().min(2).optional(),
  email:       z.string().email().optional(),
  role:        z.enum(ROLES).optional(),
  unidade:     z.string().optional().nullable(),
  bloco:       z.string().optional().nullable(),
  telefone:    z.string().optional().nullable(),
  prestadorId: z.string().uuid().optional().nullable(),
  isActive:    z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }

const SELECT = {
  id: true, nome: true, email: true, role: true,
  unidade: true, bloco: true, telefone: true,
  isActive: true, primeiroAcesso: true, createdAt: true, prestadorId: true,
  prestador: { select: { id: true, nome: true } },
} as const

// PATCH /api/moradores/[id] — atualiza dados
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
    const alvo = await prisma.usuario.findFirst({
      where: { id, condominioId: session.condominioId },
    })

    if (!alvo) {
      return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 })
    }

    // Promover/rebaixar síndicos é exclusivo do síndico/administradora
    const mexeEmGestor = ["SINDICO", "SUBSINDICO"].includes(alvo.role) ||
      (parsed.data.role && ["SINDICO", "SUBSINDICO"].includes(parsed.data.role))
    if (parsed.data.role && parsed.data.role !== alvo.role && mexeEmGestor && !ehSindico(session.role)) {
      return NextResponse.json({ message: "Apenas o síndico pode alterar este perfil" }, { status: 403 })
    }

    const data = { ...parsed.data }
    const roleFinal = data.role ?? alvo.role
    if (roleFinal !== "PRESTADOR") data.prestadorId = null

    const atualizado = await prisma.usuario.update({
      where: { id },
      data,
      select: SELECT,
    })

    await registrarAuditoria(
      session, "EDITAR", "Usuario", id,
      parsed.data.role && parsed.data.role !== alvo.role
        ? `Alterou o perfil de ${alvo.nome}: ${alvo.role} → ${parsed.data.role}`
        : `Editou o cadastro de ${alvo.nome}`,
      { campos: Object.keys(parsed.data) }
    )

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

  if (!podeGerenciar(session.role)) {
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

    await registrarAuditoria(session, "EXCLUIR", "Usuario", id, `Desativou ${alvo.nome}`)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/moradores/[id]]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

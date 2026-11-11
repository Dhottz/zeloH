import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { podeGerenciar } from "@/lib/permissions"
import { z } from "zod"

const updateSchema = z.object({
  nome:     z.string().min(2, "Nome obrigatório").optional(),
  cnpj:     z.string().optional().nullable(),
  email:    z.string().email("E-mail inválido").optional().nullable(),
  telefone: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  cidade:   z.string().optional().nullable(),
  estado:   z.string().optional().nullable(),
  cep:      z.string().optional().nullable(),
  blocos:   z.array(z.string()).optional(),
})

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: session.sub },
      include: {
        condominio: {
          select: {
            id: true, nome: true, cnpj: true, email: true,
            telefone: true, endereco: true, cidade: true,
            estado: true, cep: true, visttoClientId: true, blocos: true,
          },
        },
      },
    })

    if (!usuario?.condominio) {
      return NextResponse.json({ message: "Condomínio não encontrado" }, { status: 404 })
    }

    return NextResponse.json(usuario.condominio)
  } catch (error) {
    console.error("[GET /api/condominio]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  }

  // Apenas síndico ou admin pode editar
  if (!podeGerenciar(session.role)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: session.sub },
      select: { condominioId: true },
    })

    if (!usuario?.condominioId) {
      return NextResponse.json({ message: "Condomínio não encontrado" }, { status: 404 })
    }

    // Normaliza o CNPJ removendo formatação antes de salvar
    const data = { ...parsed.data }
    if (data.cnpj) {
      data.cnpj = data.cnpj.replace(/\D/g, "")
    }

    const atualizado = await prisma.condominio.update({
      where: { id: usuario.condominioId },
      data,
    })

    return NextResponse.json(atualizado)
  } catch (error) {
    console.error("[PATCH /api/condominio]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

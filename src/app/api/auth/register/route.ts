import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword, createToken, setAuthCookie } from "@/lib/auth"
import { z } from "zod"

const schema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  condominioNome: z.string().min(2),
  condominioCnpj: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nome, email, password, condominioNome, condominioCnpj } = schema.parse(body)

    const existe = await prisma.usuario.findUnique({ where: { email } })
    if (existe) {
      return NextResponse.json({ message: "E-mail já cadastrado" }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)

    // Cria condomínio + síndico em uma transação
    const result = await prisma.$transaction(async (tx) => {
      const condominio = await tx.condominio.create({
        data: {
          nome: condominioNome,
          cnpj: condominioCnpj ? condominioCnpj.replace(/\D/g, "") || null : null,
        },
      })

      const usuario = await tx.usuario.create({
        data: {
          nome,
          email,
          passwordHash,
          role: "SINDICO",
          condominioId: condominio.id,
        },
      })

      return { condominio, usuario }
    })

    const token = await createToken({
      sub: result.usuario.id,
      email: result.usuario.email,
      role: result.usuario.role,
      condominioId: result.condominio.id,
      nome: result.usuario.nome,
    })

    await setAuthCookie(token)

    return NextResponse.json(
      {
        usuario: {
          id: result.usuario.id,
          nome: result.usuario.nome,
          email: result.usuario.email,
          role: result.usuario.role,
          condominio: result.condominio,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Dados inválidos", errors: error.issues }, { status: 400 })
    }
    console.error("[API/auth/register]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

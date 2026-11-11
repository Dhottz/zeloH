import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession, comparePassword, hashPassword } from "@/lib/auth"
import { z } from "zod"

const schema = z.object({
  senhaAtual: z.string().min(1),
  novaSenha:  z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
})

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: session.sub },
      select: { id: true, passwordHash: true },
    })
    if (!usuario) return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 })

    const senhaOk = await comparePassword(parsed.data.senhaAtual, usuario.passwordHash)
    if (!senhaOk) {
      return NextResponse.json({ message: "Senha atual incorreta" }, { status: 400 })
    }

    const hash = await hashPassword(parsed.data.novaSenha)
    await prisma.usuario.update({
      where: { id: session.sub },
      data: { passwordHash: hash },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST /api/auth/alterar-senha]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

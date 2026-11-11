import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { comparePassword, createToken, setAuthCookie } from "@/lib/auth"
import { enviarConvite } from "@/lib/convite"
import { z } from "zod"

const schema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = schema.parse(body)

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { condominio: { select: { id: true, nome: true } } },
    })

    if (!usuario || !usuario.isActive) {
      return NextResponse.json({ message: "Credenciais inválidas" }, { status: 401 })
    }

    // ── Primeiro acesso: o usuário ainda não criou senha ──────────────────────
    // O link para criar a senha vai só para o e-mail cadastrado (nunca na resposta),
    // senão qualquer pessoa que soubesse o e-mail poderia assumir a conta.
    if (usuario.primeiroAcesso) {
      const { enviado } = await enviarConvite(usuario, usuario.condominio.nome)
      return NextResponse.json(
        {
          message: enviado
            ? "Seu acesso ainda não foi ativado. Enviamos um link para o seu e-mail para você criar a senha."
            : "Seu acesso ainda não foi ativado. Peça ao síndico o link de convite para criar sua senha.",
        },
        { status: 403 }
      )
    }

    const senhaCorreta = await comparePassword(password, usuario.passwordHash)
    if (!senhaCorreta) {
      return NextResponse.json({ message: "Credenciais inválidas" }, { status: 401 })
    }

    const token = await createToken({
      sub:          usuario.id,
      email:        usuario.email,
      role:         usuario.role,
      condominioId: usuario.condominioId,
      nome:         usuario.nome,
      prestadorId:  usuario.prestadorId,
    })

    await setAuthCookie(token)

    return NextResponse.json({
      usuario: {
        id:         usuario.id,
        nome:       usuario.nome,
        email:      usuario.email,
        role:       usuario.role,
        unidade:    usuario.unidade,
        bloco:      usuario.bloco,
        condominio: usuario.condominio,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Dados inválidos" }, { status: 400 })
    }
    console.error("[API/auth/login]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

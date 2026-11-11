import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { comparePassword, createToken, setAuthCookie } from "@/lib/auth"
import { SignJWT } from "jose"
import { z } from "zod"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "zeloh-dev-secret-min-32-chars-ok!"
)

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

    // ── Primeiro acesso: morador ainda não definiu senha ──────────────────────
    if (usuario.primeiroAcesso) {
      // Gera token de setup com 24h de validade (não loga, apenas autoriza definir senha)
      const setupToken = await new SignJWT({ sub: usuario.id, tipo: "setup-senha" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(JWT_SECRET)

      return NextResponse.json(
        { primeiroAcesso: true, setupToken },
        { status: 200 }
      )
    }

    // ── Login normal ──────────────────────────────────────────────────────────
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
    })

    await setAuthCookie(token)

    return NextResponse.json({
      usuario: {
        id:        usuario.id,
        nome:      usuario.nome,
        email:     usuario.email,
        role:      usuario.role,
        unidade:   usuario.unidade,
        bloco:     usuario.bloco,
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

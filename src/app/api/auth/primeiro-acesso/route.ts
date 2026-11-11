import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword, createToken, setAuthCookie } from "@/lib/auth"
import { jwtVerify } from "jose"
import { z } from "zod"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "zeloh-dev-secret-min-32-chars-ok!"
)

const schema = z.object({
  setupToken: z.string(),
  senha:      z.string().min(6, "Senha mínima de 6 caracteres"),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
  }

  const { setupToken, senha } = parsed.data

  // Valida o token de setup
  let userId: string
  try {
    const { payload } = await jwtVerify(setupToken, JWT_SECRET)
    if (payload.tipo !== "setup-senha" || !payload.sub) {
      throw new Error("Token inválido")
    }
    userId = payload.sub as string
  } catch {
    return NextResponse.json({ message: "Link de acesso inválido ou expirado." }, { status: 401 })
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: { condominio: { select: { id: true, nome: true } } },
    })

    if (!usuario || !usuario.isActive || !usuario.primeiroAcesso) {
      return NextResponse.json({ message: "Link inválido." }, { status: 401 })
    }

    // Define a senha e marca o primeiro acesso como concluído
    const passwordHash = await hashPassword(senha)
    await prisma.usuario.update({
      where: { id: userId },
      data: { passwordHash, primeiroAcesso: false },
    })

    // Loga automaticamente após definir a senha
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
    console.error("[primeiro-acesso]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

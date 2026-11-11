import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createToken, setAuthCookie } from "@/lib/auth"
import { exigirSessao, lerCorpo, erro } from "@/lib/api"
import { z } from "zod"

const schema = z.object({ condominioId: z.string().uuid() })

/** POST /api/auth/trocar-condominio — muda o condomínio ativo (administradoras / síndicos profissionais). */
export async function POST(req: NextRequest) {
  const s = await exigirSessao()
  if (!s.ok) return s.res
  const corpo = await lerCorpo(req, schema)
  if (!corpo.ok) return corpo.res

  const usuario = await prisma.usuario.findUnique({
    where: { id: s.data.sub },
    select: { id: true, nome: true, email: true, role: true, condominioId: true, prestadorId: true, isActive: true },
  })
  if (!usuario?.isActive) return erro("Usuário não encontrado", 404)

  let role: string = usuario.role
  if (corpo.data.condominioId !== usuario.condominioId) {
    const vinculo = await prisma.usuarioCondominio.findUnique({
      where: { usuarioId_condominioId: { usuarioId: usuario.id, condominioId: corpo.data.condominioId } },
    })
    if (!vinculo) return erro("Sem acesso a este condomínio", 403)
    role = vinculo.role
  }

  const token = await createToken({
    sub:          usuario.id,
    email:        usuario.email,
    nome:         usuario.nome,
    role,
    condominioId: corpo.data.condominioId,
    prestadorId:  usuario.prestadorId,
  })
  await setAuthCookie(token)

  return NextResponse.json({ ok: true, role })
}

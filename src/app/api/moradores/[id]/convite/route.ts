import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, erro } from "@/lib/api"
import { podeGerenciar } from "@/lib/permissions"
import { enviarConvite } from "@/lib/convite"

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/moradores/[id]/convite — gera um novo link de primeiro acesso,
 * envia por e-mail (se configurado) e devolve o link para o síndico copiar.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const { id } = await params

  const usuario = await prisma.usuario.findFirst({
    where: { id, condominioId: s.data.condominioId },
    select: { id: true, nome: true, email: true, primeiroAcesso: true, isActive: true, condominio: { select: { nome: true } } },
  })
  if (!usuario) return erro("Usuário não encontrado", 404)
  if (!usuario.isActive) return erro("Usuário desativado")
  if (!usuario.primeiroAcesso) return erro("Este usuário já criou a senha")
  if (usuario.email.endsWith("@zeloh.internal")) return erro("Cadastre um e-mail para este usuário antes de convidar")

  const { link, enviado } = await enviarConvite(usuario, usuario.condominio.nome)
  return NextResponse.json({ link, enviado })
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao } from "@/lib/api"

/** GET — notificações pessoais do usuário logado (sininho do app do morador). */
export async function GET() {
  const s = await exigirSessao()
  if (!s.ok) return s.res

  const [notificacoes, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where: { usuarioId: s.data.sub, condominioId: s.data.condominioId },
      orderBy: { criadaEm: "desc" },
      take: 40,
      select: { id: true, titulo: true, descricao: true, link: true, lidaEm: true, criadaEm: true },
    }),
    prisma.notificacao.count({
      where: { usuarioId: s.data.sub, condominioId: s.data.condominioId, lidaEm: null },
    }),
  ])

  return NextResponse.json({ notificacoes, naoLidas })
}

/** PATCH — marca todas como lidas. */
export async function PATCH() {
  const s = await exigirSessao()
  if (!s.ok) return s.res

  await prisma.notificacao.updateMany({
    where: { usuarioId: s.data.sub, lidaEm: null },
    data: { lidaEm: new Date() },
  })
  return NextResponse.json({ ok: true })
}

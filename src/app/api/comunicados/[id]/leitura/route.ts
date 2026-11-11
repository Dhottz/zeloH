import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, erro } from "@/lib/api"
import { destinatariosDe } from "@/lib/comunicados"

type Params = { params: Promise<{ id: string }> }

/** POST — o morador confirma que leu o comunicado. */
export async function POST(_req: NextRequest, { params }: Params) {
  const s = await exigirSessao()
  if (!s.ok) return s.res
  const { id } = await params

  const c = await prisma.comunicado.findFirst({ where: { id, condominioId: s.data.condominioId }, select: { id: true } })
  if (!c) return erro("Comunicado não encontrado", 404)

  await prisma.comunicadoLeitura.upsert({
    where: { comunicadoId_usuarioId: { comunicadoId: id, usuarioId: s.data.sub } },
    create: { comunicadoId: id, usuarioId: s.data.sub },
    update: {},
  })
  return NextResponse.json({ ok: true })
}

/** GET — equipe vê quem leu e quem ainda não leu. */
export async function GET(_req: NextRequest, { params }: Params) {
  const s = await exigirSessao((r) => r !== "MORADOR" && r !== "PRESTADOR")
  if (!s.ok) return s.res
  const { id } = await params

  const c = await prisma.comunicado.findFirst({
    where: { id, condominioId: s.data.condominioId },
    include: { leituras: { select: { usuarioId: true, lidoEm: true } } },
  })
  if (!c) return erro("Comunicado não encontrado", 404)

  const destinatarios = await destinatariosDe(s.data.condominioId, c)
  const lidoEm = new Map(c.leituras.map((l) => [l.usuarioId, l.lidoEm]))

  return NextResponse.json({
    leram: destinatarios.filter((d) => lidoEm.has(d.id)).map((d) => ({ ...d, lidoEm: lidoEm.get(d.id) })),
    naoLeram: destinatarios.filter((d) => !lidoEm.has(d.id)),
  })
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, lerCorpo, erro } from "@/lib/api"
import { z } from "zod"

type Params = { params: Promise<{ id: string }> }

const schema = z.object({ opcoes: z.array(z.number().int().min(0)).min(1, "Escolha uma opção") })

/** POST — registra (ou altera, enquanto aberta) o voto do usuário. Um voto por pessoa. */
export async function POST(req: NextRequest, { params }: Params) {
  const s = await exigirSessao((r) => r === "MORADOR" || r === "CONSELHO" || r === "SINDICO" || r === "SUBSINDICO")
  if (!s.ok) return s.res
  const corpo = await lerCorpo(req, schema)
  if (!corpo.ok) return corpo.res
  const { id } = await params

  const e = await prisma.enquete.findFirst({ where: { id, condominioId: s.data.condominioId } })
  if (!e) return erro("Enquete não encontrada", 404)
  if (e.encerrada || (e.encerraEm && e.encerraEm.getTime() < Date.now())) return erro("Esta enquete já foi encerrada")

  const opcoes = [...new Set(corpo.data.opcoes)].filter((i) => i < e.opcoes.length)
  if (opcoes.length === 0) return erro("Opção inválida")
  if (!e.multiplaEscolha && opcoes.length > 1) return erro("Escolha apenas uma opção")

  await prisma.enqueteVoto.upsert({
    where: { enqueteId_usuarioId: { enqueteId: id, usuarioId: s.data.sub } },
    create: { enqueteId: id, usuarioId: s.data.sub, opcoes },
    update: { opcoes },
  })
  return NextResponse.json({ ok: true })
}

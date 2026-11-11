import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, erro } from "@/lib/api"
import { podeGerenciar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { z } from "zod"

type Params = { params: Promise<{ id: string }> }

/** PATCH { encerrada: boolean } — encerra ou reabre a votação. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const { id } = await params
  const body = z.object({ encerrada: z.boolean() }).safeParse(await req.json().catch(() => null))
  if (!body.success) return erro("Dados inválidos")

  const e = await prisma.enquete.findFirst({ where: { id, condominioId: s.data.condominioId } })
  if (!e) return erro("Enquete não encontrada", 404)

  const atualizada = await prisma.enquete.update({
    where: { id },
    data: { encerrada: body.data.encerrada, ...(body.data.encerrada ? {} : { encerraEm: null }) },
  })
  await registrarAuditoria(s.data, "EDITAR", "Enquete", id, `${body.data.encerrada ? "Encerrou" : "Reabriu"} a enquete "${e.titulo}"`)
  return NextResponse.json(atualizada)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const { id } = await params

  const e = await prisma.enquete.findFirst({ where: { id, condominioId: s.data.condominioId } })
  if (!e) return erro("Enquete não encontrada", 404)

  await prisma.enquete.delete({ where: { id } })
  await registrarAuditoria(s.data, "EXCLUIR", "Enquete", id, `Excluiu a enquete "${e.titulo}"`)
  return NextResponse.json({ ok: true })
}

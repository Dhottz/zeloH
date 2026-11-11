import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { podeGerenciar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { removerArquivos } from "@/lib/storage"

/** DELETE — exclui uma versão. Se era a atual, a versão anterior volta a ser a vigente. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (!podeGerenciar(session.role)) return NextResponse.json({ message: "Acesso negado" }, { status: 403 })

  const { id } = await params

  const doc = await prisma.documento.findFirst({
    where: { id, condominioId: session.condominioId },
  })
  if (!doc) return NextResponse.json({ message: "Documento não encontrado" }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    await tx.documento.delete({ where: { id } })
    if (doc.atual && doc.grupoId) {
      const anterior = await tx.documento.findFirst({
        where: { condominioId: session.condominioId, grupoId: doc.grupoId },
        orderBy: { versao: "desc" },
      })
      if (anterior) await tx.documento.update({ where: { id: anterior.id }, data: { atual: true } })
    }
  })

  if (doc.arquivo) await removerArquivos([doc.arquivo]).catch(() => {})
  await registrarAuditoria(session, "EXCLUIR", "Documento", id, `Excluiu "${doc.nome}" (versão ${doc.versao})`)

  return NextResponse.json({ message: "Documento excluído com sucesso" })
}

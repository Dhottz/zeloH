import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (session.role === "MORADOR") return NextResponse.json({ message: "Acesso negado" }, { status: 403 })

  const { id } = await params

  const doc = await prisma.documento.findFirst({
    where: { id, condominioId: session.condominioId },
  })

  if (!doc) return NextResponse.json({ message: "Documento não encontrado" }, { status: 404 })

  await prisma.documento.delete({ where: { id } })

  return NextResponse.json({ message: "Documento excluído com sucesso" })
}

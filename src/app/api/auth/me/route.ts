import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      unidade: true,
      bloco: true,
      primeiroAcesso: true,
      isActive: true,
      condominio: { select: { id: true, nome: true, cnpj: true } },
    },
  })

  if (!usuario || !usuario.isActive) {
    return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 })
  }

  return NextResponse.json({ usuario })
}

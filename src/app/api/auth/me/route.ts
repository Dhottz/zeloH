import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { modulosLiberados, diasRestantesTrial } from "@/lib/planos"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  }

  const [usuario, condominio, vinculos] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.sub },
      select: {
        id: true, nome: true, email: true, role: true, unidade: true, bloco: true,
        primeiroAcesso: true, isActive: true, prestadorId: true, notificarEmail: true,
        condominio: { select: { id: true, nome: true } },
      },
    }),
    prisma.condominio.findUnique({
      where: { id: session.condominioId },
      select: { id: true, nome: true, cnpj: true, plano: true, assinaturaStatus: true, trialAte: true, blocos: true },
    }),
    prisma.usuarioCondominio.findMany({
      where: { usuarioId: session.sub },
      select: { role: true, condominio: { select: { id: true, nome: true } } },
      orderBy: { condominio: { nome: "asc" } },
    }),
  ])

  if (!usuario || !usuario.isActive || !condominio) {
    return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 })
  }

  // Condomínios acessíveis: o de origem + os vinculados (administradoras)
  const condominios = [
    { id: usuario.condominio.id, nome: usuario.condominio.nome, role: usuario.role as string },
    ...vinculos
      .filter((v) => v.condominio.id !== usuario.condominio.id)
      .map((v) => ({ id: v.condominio.id, nome: v.condominio.nome, role: v.role as string })),
  ]

  return NextResponse.json({
    usuario: {
      ...usuario,
      // Perfil e condomínio ativos vêm da sessão (podem diferir do cadastro de origem)
      role: session.role,
      condominio: { id: condominio.id, nome: condominio.nome, cnpj: condominio.cnpj, blocos: condominio.blocos },
      condominios,
      assinatura: {
        plano:       condominio.plano,
        status:      condominio.assinaturaStatus,
        trialAte:    condominio.trialAte,
        diasTrial:   diasRestantesTrial(condominio),
        modulos:     modulosLiberados(condominio),
      },
    },
  })
}

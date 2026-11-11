import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  if (session.role !== "SINDICO" && session.role !== "ADMIN") {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  try {
    const existe = await prisma.manutencaoHistorico.findFirst({
      where: { id, condominioId: session.condominioId },
    })
    if (!existe) return NextResponse.json({ message: "Manutenção não encontrada" }, { status: 404 })

    // Campos permitidos para atualização
    const data: Record<string, unknown> = {}

    if (typeof body.visivelParaMoradores === "boolean")
      data.visivelParaMoradores = body.visivelParaMoradores

    if (typeof body.titulo === "string" && body.titulo.trim())
      data.titulo = body.titulo.trim()

    if ("descricao" in body)
      data.descricao = body.descricao ?? null

    if (typeof body.status === "string")
      data.status = body.status

    if (typeof body.prioridade === "string")
      data.prioridade = body.prioridade

    if ("empresaNome" in body)
      data.empresaNome = body.empresaNome ?? null

    if ("prestadorNome" in body)
      data.prestadorNome = body.prestadorNome ?? null

    if ("prestadorCnpj" in body)
      data.prestadorCnpj = body.prestadorCnpj ?? null

    if ("local" in body)
      data.local = body.local ?? null

    if ("observacoes" in body)
      data.observacoes = body.observacoes ?? null

    if ("valor" in body)
      data.valor = body.valor != null ? Number(body.valor) : null

    if ("agendadoEm" in body)
      data.agendadoEm = body.agendadoEm ? new Date(body.agendadoEm as string) : null

    if (Object.keys(data).length === 0)
      return NextResponse.json({ message: "Nenhum campo válido para atualizar" }, { status: 400 })

    const atualizado = await prisma.manutencaoHistorico.update({
      where: { id },
      data,
    })

    return NextResponse.json(atualizado)
  } catch (error) {
    console.error("[PATCH /api/manutencoes/[id]]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

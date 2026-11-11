import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

const VISTTO_API_URL = process.env.VISTTO_API_URL
const VISTTO_API_KEY = process.env.VISTTO_API_KEY

/**
 * POST /api/vistto/vincular
 * Vincula o condomínio autenticado a um client do VISTTO pelo CNPJ.
 * Salva o visttoClientId no banco para lookups futuros sem depender do CNPJ.
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  }

  if (!VISTTO_API_URL || !VISTTO_API_KEY) {
    return NextResponse.json(
      { message: "Integração VISTTO não configurada no servidor" },
      { status: 503 }
    )
  }

  // Busca o condomínio do usuário autenticado
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.sub },
    include: { condominio: true },
  })

  if (!usuario?.condominioId || !usuario.condominio) {
    return NextResponse.json({ message: "Condomínio não encontrado" }, { status: 404 })
  }

  const { condominio } = usuario

  if (!condominio.cnpj) {
    return NextResponse.json(
      { message: "Condomínio sem CNPJ cadastrado. Adicione o CNPJ antes de vincular." },
      { status: 400 }
    )
  }

  // Busca o client no VISTTO pelo CNPJ
  const cnpjLimpo = condominio.cnpj.replace(/\D/g, "")

  let visttoClientId: string

  try {
    const res = await fetch(
      `${VISTTO_API_URL}/clients/by-document/${cnpjLimpo}`,
      {
        headers: {
          "x-api-key": VISTTO_API_KEY,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (res.status === 404) {
      return NextResponse.json(
        {
          message:
            "CNPJ não encontrado no VISTTO. Certifique-se de que o condomínio está cadastrado como cliente no VISTTO.",
        },
        { status: 404 }
      )
    }

    if (!res.ok) {
      const body = await res.text()
      console.error("[vincular] Erro VISTTO:", res.status, body)
      return NextResponse.json(
        { message: "Erro ao consultar o VISTTO. Tente novamente." },
        { status: 502 }
      )
    }

    const client = await res.json()
    visttoClientId = client.id
  } catch (err) {
    console.error("[vincular] Falha na requisição ao VISTTO:", err)
    return NextResponse.json(
      { message: "Não foi possível conectar ao VISTTO. Verifique a URL da integração." },
      { status: 503 }
    )
  }

  // Salva o visttoClientId no condomínio
  const atualizado = await prisma.condominio.update({
    where: { id: condominio.id },
    data: { visttoClientId },
  })

  return NextResponse.json({
    ok: true,
    message: "Condomínio vinculado ao VISTTO com sucesso.",
    visttoClientId: atualizado.visttoClientId,
    condominioId: atualizado.id,
  })
}

/**
 * DELETE /api/vistto/vincular
 * Remove a vinculação do condomínio com o VISTTO.
 */
export async function DELETE(_req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.sub },
    include: { condominio: true },
  })

  if (!usuario?.condominioId) {
    return NextResponse.json({ message: "Condomínio não encontrado" }, { status: 404 })
  }

  await prisma.condominio.update({
    where: { id: usuario.condominioId },
    data: { visttoClientId: null },
  })

  return NextResponse.json({ ok: true, message: "Vinculação removida com sucesso." })
}

/**
 * GET /api/vistto/vincular
 * Retorna o status atual da vinculação.
 */
export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.sub },
    include: { condominio: { select: { id: true, cnpj: true, visttoClientId: true } } },
  })

  if (!usuario?.condominio) {
    return NextResponse.json({ message: "Condomínio não encontrado" }, { status: 404 })
  }

  const { condominio } = usuario

  return NextResponse.json({
    vinculado: !!condominio.visttoClientId,
    visttoClientId: condominio.visttoClientId,
    cnpj: condominio.cnpj,
  })
}

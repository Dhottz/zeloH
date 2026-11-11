import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// ─── GET: retorna o texto do regimento ───────────────────────────────────────

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  try {
    const condo = await prisma.condominio.findUnique({
      where: { id: session.condominioId },
      select: { regimento: true },
    })
    return NextResponse.json({ regimento: condo?.regimento ?? null })
  } catch (error) {
    console.error("[GET /api/condominio/regimento]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

// ─── POST: salva o texto do regimento ────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (session.role !== "SINDICO" && session.role !== "ADMIN") {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  const { regimento } = body as { regimento?: string }

  try {
    await prisma.condominio.update({
      where: { id: session.condominioId },
      data: { regimento: regimento ?? null },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST /api/condominio/regimento]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

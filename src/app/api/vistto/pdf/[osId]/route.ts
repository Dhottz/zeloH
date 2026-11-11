import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

const VISTTO_API_URL = process.env.VISTTO_API_URL
const VISTTO_API_KEY = process.env.VISTTO_API_KEY

/**
 * GET /api/vistto/pdf/[osId]
 * Faz proxy do PDF da OS no VISTTO para não expor a API key no frontend.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ osId: string }> }
) {
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

  const { osId } = await params

  try {
    const res = await fetch(
      `${VISTTO_API_URL}/service-orders/${osId}/pdf`,
      {
        headers: {
          "x-api-key": VISTTO_API_KEY,
        },
        signal: AbortSignal.timeout(20000),
      }
    )

    if (!res.ok) {
      return NextResponse.json(
        { message: "PDF não disponível no VISTTO." },
        { status: res.status }
      )
    }

    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="OS-${osId}.pdf"`,
      },
    })
  } catch (err) {
    console.error("[vistto/pdf] Erro:", err)
    return NextResponse.json(
      { message: "Erro ao buscar PDF no VISTTO." },
      { status: 502 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import QRCode from "qrcode"
import { prisma } from "@/lib/prisma"
import { exigirSessao, erro } from "@/lib/api"
import { appUrl } from "@/lib/email"

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/equipamentos/[id]/qrcode — SVG do QR Code que abre a ficha do equipamento.
 * Quem escaneia precisa estar logado (o link leva à página protegida do painel).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const s = await exigirSessao((r) => r !== "MORADOR")
  if (!s.ok) return s.res
  const { id } = await params

  const eq = await prisma.equipamento.findFirst({ where: { id, condominioId: s.data.condominioId }, select: { id: true } })
  if (!eq) return erro("Equipamento não encontrado", 404)

  const svg = await QRCode.toString(appUrl(`/equipamentos/${id}`), {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#1C1410", light: "#FFFFFF" },
  })

  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=86400" },
  })
}

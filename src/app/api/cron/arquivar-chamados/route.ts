import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 })
  }

  const limite = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

  const { count } = await prisma.chamado.updateMany({
    where: {
      status: "CONCLUIDO",
      updatedAt: { lt: limite },
    },
    data: { status: "ARQUIVADO" },
  })

  return NextResponse.json({ arquivados: count })
}

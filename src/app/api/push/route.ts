import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, lerCorpo } from "@/lib/api"
import { z } from "zod"

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
})

/** GET — chave pública VAPID (o navegador precisa dela para se inscrever). */
export async function GET() {
  return NextResponse.json({ publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null })
}

/** POST — registra a inscrição de push deste navegador para o usuário logado. */
export async function POST(req: NextRequest) {
  const s = await exigirSessao()
  if (!s.ok) return s.res
  const corpo = await lerCorpo(req, schema)
  if (!corpo.ok) return corpo.res

  const { endpoint, keys } = corpo.data
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, usuarioId: s.data.sub },
    update: { p256dh: keys.p256dh, auth: keys.auth, usuarioId: s.data.sub },
  })
  return NextResponse.json({ ok: true })
}

/** DELETE — cancela a inscrição deste navegador. */
export async function DELETE(req: NextRequest) {
  const s = await exigirSessao()
  if (!s.ok) return s.res
  const endpoint = req.nextUrl.searchParams.get("endpoint")
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, usuarioId: s.data.sub } })
  }
  return NextResponse.json({ ok: true })
}

import webpush from "web-push"
import { prisma } from "./prisma"

/**
 * Web Push (notificação no celular/navegador, mesmo com o app fechado).
 * Requer NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY.
 * Gere com: npx web-push generate-vapid-keys
 */

let configurado: boolean | null = null

function configurar(): boolean {
  if (configurado !== null) return configurado
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    configurado = false
    return false
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:contato@zeloh.app", publicKey, privateKey)
  configurado = true
  return true
}

export interface PushPayload {
  titulo: string
  corpo?: string
  link?: string
}

export async function enviarPush(usuarioIds: string[], payload: PushPayload): Promise<void> {
  if (!configurar() || usuarioIds.length === 0) return

  const subs = await prisma.pushSubscription.findMany({
    where: { usuarioId: { in: usuarioIds } },
  })

  const body = JSON.stringify({ title: payload.titulo, body: payload.corpo ?? "", url: payload.link ?? "/" })

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body)
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        // Inscrição expirada/removida pelo navegador → apaga
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
        } else {
          console.error("[push]", status, err)
        }
      }
    })
  )
}

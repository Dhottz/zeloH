import { iconeApp } from "@/lib/icone-app"

/**
 * Ícones do PWA: /icons/icon-192.png, /icons/icon-512.png,
 * /icons/maskable-192.png, /icons/maskable-512.png, /icons/apple-180.png
 */
export async function GET(_req: Request, { params }: { params: Promise<{ arquivo: string }> }) {
  const { arquivo } = await params
  const m = arquivo.match(/^(icon|maskable|apple)-(\d{2,4})\.png$/)
  const tamanho = m ? Number(m[2]) : 0
  if (!m || tamanho < 48 || tamanho > 1024) return new Response("Não encontrado", { status: 404 })

  const img = iconeApp(tamanho, { maskable: m[1] === "maskable", arredondado: m[1] === "icon" })
  img.headers.set("Cache-Control", "public, max-age=604800, immutable")
  return img
}

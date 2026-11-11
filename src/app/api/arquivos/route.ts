import { NextRequest, NextResponse } from "next/server"
import { exigirSessao, erro } from "@/lib/api"
import { pertenceAo, urlAssinada } from "@/lib/storage"

/** GET /api/arquivos?path=... — checa o condomínio e redireciona para URL assinada (1h). */
export async function GET(req: NextRequest) {
  const s = await exigirSessao()
  if (!s.ok) return s.res

  const caminho = req.nextUrl.searchParams.get("path") ?? ""
  if (!caminho || !pertenceAo(caminho, s.data.condominioId)) {
    return erro("Arquivo não encontrado", 404)
  }

  try {
    const url = await urlAssinada(caminho)
    return NextResponse.redirect(url, { headers: { "Cache-Control": "private, max-age=600" } })
  } catch (err) {
    console.error("[GET /api/arquivos]", err)
    return erro("Arquivo indisponível", 404)
  }
}

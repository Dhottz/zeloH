import { NextRequest, NextResponse } from "next/server"
import { exigirSessao, erro } from "@/lib/api"
import {
  PASTAS, TAMANHO_MAXIMO, extensaoPermitida, salvarArquivo, storageConfigurado, type Pasta,
} from "@/lib/storage"

// Moradores só enviam fotos de ocorrências; a equipe envia para qualquer pasta.
const PASTAS_MORADOR: Pasta[] = ["chamados"]

/** POST /api/arquivos/upload — multipart: file, pasta. Retorna { path }. */
export async function POST(req: NextRequest) {
  const s = await exigirSessao()
  if (!s.ok) return s.res
  const session = s.data

  if (!storageConfigurado()) {
    return erro("Armazenamento de arquivos não configurado. Defina as chaves do Supabase.", 503)
  }

  let form: FormData
  try { form = await req.formData() } catch { return erro("Envio inválido") }

  const arquivo = form.get("file")
  const pasta   = String(form.get("pasta") ?? "") as Pasta

  if (!(arquivo instanceof File)) return erro("Nenhum arquivo enviado")
  if (!PASTAS.includes(pasta)) return erro("Pasta inválida")
  if (session.role === "MORADOR" && !PASTAS_MORADOR.includes(pasta)) return erro("Sem permissão", 403)
  if (arquivo.size > TAMANHO_MAXIMO) return erro("Arquivo maior que 10 MB")
  if (!extensaoPermitida(arquivo.type)) return erro("Envie imagens (JPG, PNG, WEBP) ou PDF")

  try {
    const path = await salvarArquivo(session.condominioId, pasta, await arquivo.arrayBuffer(), arquivo.type)
    return NextResponse.json({ path, nome: arquivo.name, tamanho: arquivo.size, tipo: arquivo.type }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/arquivos/upload]", err)
    return erro("Falha ao salvar o arquivo", 500)
  }
}

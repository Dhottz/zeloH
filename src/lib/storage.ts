import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"

/**
 * Armazenamento de arquivos (fotos, PDFs) no Supabase Storage.
 * Bucket privado; o acesso é sempre via /api/arquivos, que checa o condomínio
 * e redireciona para uma URL assinada temporária.
 *
 * Caminho: {condominioId}/{pasta}/{uuid}.{ext}
 */

export const BUCKET = process.env.SUPABASE_BUCKET ?? "zeloh"
export const TAMANHO_MAXIMO = 10 * 1024 * 1024 // 10 MB

export const PASTAS = [
  "chamados", "manutencoes", "equipamentos", "encomendas", "contratos",
  "certificados", "documentos", "despesas", "comunicados", "orcamentos",
] as const
export type Pasta = (typeof PASTAS)[number]

const TIPOS_PERMITIDOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
}

let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase Storage não configurado (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).")
  client = createClient(url, key, { auth: { persistSession: false } })
  return client
}

export function storageConfigurado(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

export function extensaoPermitida(mime: string): string | null {
  return TIPOS_PERMITIDOS[mime] ?? null
}

export async function salvarArquivo(
  condominioId: string,
  pasta: Pasta,
  dados: ArrayBuffer,
  mime: string
): Promise<string> {
  const ext = extensaoPermitida(mime)
  if (!ext) throw new Error("Tipo de arquivo não permitido")
  const caminho = `${condominioId}/${pasta}/${randomUUID()}.${ext}`
  const { error } = await getClient().storage.from(BUCKET).upload(caminho, dados, {
    contentType: mime,
    upsert: false,
  })
  if (error) throw new Error(`Falha no upload: ${error.message}`)
  return caminho
}

export async function urlAssinada(caminho: string, segundos = 3600): Promise<string> {
  const { data, error } = await getClient().storage.from(BUCKET).createSignedUrl(caminho, segundos)
  if (error || !data) throw new Error(`Arquivo indisponível: ${error?.message ?? ""}`)
  return data.signedUrl
}

export async function removerArquivos(caminhos: string[]): Promise<void> {
  if (caminhos.length === 0) return
  const { error } = await getClient().storage.from(BUCKET).remove(caminhos)
  if (error) console.error("[storage.remover]", error.message)
}

/** O caminho pertence ao condomínio informado? (evita acesso cruzado entre condomínios) */
export function pertenceAo(caminho: string, condominioId: string): boolean {
  return caminho.startsWith(`${condominioId}/`) && !caminho.includes("..")
}

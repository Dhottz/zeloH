/** Helpers de arquivo seguros para o client (sem dependências de servidor). */

/** URL do app que entrega um arquivo do storage (checa permissão e redireciona). */
export function urlArquivo(caminho: string | null | undefined): string {
  return caminho ? `/api/arquivos?path=${encodeURIComponent(caminho)}` : ""
}

export function ehPdf(caminho: string): boolean {
  return caminho.toLowerCase().endsWith(".pdf")
}

/**
 * Reduz uma foto no navegador antes do upload (máx. 1600px, JPEG 80%).
 * Mantém o plano gratuito do Supabase folgado e acelera o envio pelo celular.
 */
export async function comprimirImagem(arquivo: File, maxLado = 1600, qualidade = 0.8): Promise<File> {
  if (!arquivo.type.startsWith("image/") || arquivo.type === "image/heic") return arquivo
  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width  = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", qualidade))
    if (!blob || blob.size >= arquivo.size) return arquivo
    return new File([blob], arquivo.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" })
  } catch {
    return arquivo
  }
}

/** Envia um arquivo para /api/arquivos/upload e devolve o caminho salvo. */
export async function enviarArquivo(arquivo: File, pasta: string): Promise<string> {
  const final = await comprimirImagem(arquivo)
  const fd = new FormData()
  fd.append("file", final)
  fd.append("pasta", pasta)
  const res = await fetch("/api/arquivos/upload", { method: "POST", body: fd })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message ?? "Falha no upload")
  return data.path as string
}

"use client"

import { useRef, useState } from "react"
import { Camera, FileText, Loader2, Paperclip, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { urlArquivo, ehPdf, enviarArquivo } from "@/lib/arquivos"

/**
 * Campo de upload de fotos/PDFs. Guarda apenas os caminhos do storage (string[]).
 * No celular, "Tirar foto" abre a câmera direto.
 */
export function ArquivosInput({
  valor,
  onChange,
  pasta,
  max = 6,
  aceitarPdf = false,
  rotulo = "Adicionar foto",
  desabilitado = false,
}: {
  valor: string[]
  onChange: (v: string[]) => void
  pasta: string
  max?: number
  aceitarPdf?: boolean
  rotulo?: string
  desabilitado?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)

  const selecionar = async (lista: FileList | null) => {
    if (!lista?.length) return
    const arquivos = Array.from(lista).slice(0, Math.max(0, max - valor.length))
    setEnviando(true)
    try {
      const novos: string[] = []
      for (const a of arquivos) novos.push(await enviarArquivo(a, pasta))
      onChange([...valor, ...novos])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload")
    } finally {
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      {valor.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {valor.map((p) => (
            <div key={p} className="relative group">
              <a href={urlArquivo(p)} target="_blank" rel="noreferrer">
                {ehPdf(p) ? (
                  <div className="w-20 h-20 rounded-lg border border-border bg-muted flex flex-col items-center justify-center gap-1 text-muted-foreground">
                    <FileText className="w-6 h-6" />
                    <span className="text-[10px]">PDF</span>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urlArquivo(p)} alt="" className="w-20 h-20 rounded-lg object-cover border border-border" />
                )}
              </a>
              {!desabilitado && (
                <button
                  type="button"
                  onClick={() => onChange(valor.filter((x) => x !== p))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center opacity-90 hover:opacity-100"
                  aria-label="Remover"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!desabilitado && valor.length < max && (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple={max - valor.length > 1}
            accept={aceitarPdf ? "image/*,application/pdf" : "image/*"}
            onChange={(e) => selecionar(e.target.files)}
          />
          <button
            type="button"
            disabled={enviando}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground",
              "hover:border-primary hover:text-primary transition-colors disabled:opacity-60"
            )}
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : aceitarPdf ? <Paperclip className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            {enviando ? "Enviando..." : rotulo}
          </button>
        </>
      )}
    </div>
  )
}

/** Galeria somente leitura. */
export function GaleriaArquivos({ arquivos, tamanho = "md" }: { arquivos: string[]; tamanho?: "sm" | "md" }) {
  if (!arquivos?.length) return null
  const cls = tamanho === "sm" ? "w-14 h-14" : "w-20 h-20"
  return (
    <div className="flex flex-wrap gap-2">
      {arquivos.map((p) => (
        <a key={p} href={urlArquivo(p)} target="_blank" rel="noreferrer">
          {ehPdf(p) ? (
            <div className={cn(cls, "rounded-lg border border-border bg-muted flex flex-col items-center justify-center text-muted-foreground")}>
              <FileText className="w-5 h-5" />
              <span className="text-[10px]">PDF</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlArquivo(p)} alt="" className={cn(cls, "rounded-lg object-cover border border-border")} />
          )}
        </a>
      ))}
    </div>
  )
}

/** Upload de um único arquivo (contrato, certificado, comprovante). */
export function ArquivoUnicoInput({
  valor,
  onChange,
  pasta,
  rotulo = "Anexar PDF ou foto",
}: {
  valor: string | null
  onChange: (v: string | null) => void
  pasta: string
  rotulo?: string
}) {
  return (
    <ArquivosInput
      valor={valor ? [valor] : []}
      onChange={(v) => onChange(v[0] ?? null)}
      pasta={pasta}
      max={1}
      aceitarPdf
      rotulo={rotulo}
    />
  )
}

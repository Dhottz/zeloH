"use client"

import { useEffect, useState } from "react"
import { Download, Share, SquarePlus, X, Smartphone } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { usePwa } from "./pwa"

const CHAVE_DISPENSADO = "zeloh_instalar_dispensado_ate"

function InstrucoesIOS({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Instalar o ZeloH no iPhone</DialogTitle></DialogHeader>
        <ol className="space-y-4 text-sm">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">1</span>
            <span>No Safari, toque em <Share className="inline w-4 h-4 -mt-0.5 text-primary" /> <strong>Compartilhar</strong> (barra de baixo).</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">2</span>
            <span>Role e toque em <SquarePlus className="inline w-4 h-4 -mt-0.5 text-primary" /> <strong>Adicionar à Tela de Início</strong>.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">3</span>
            <span>Toque em <strong>Adicionar</strong>. O ícone do ZeloH aparece junto dos seus apps.</span>
          </li>
        </ol>
        <p className="text-xs text-muted-foreground">Depois de instalado, abra pelo ícone para receber notificações no celular.</p>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Convite para instalar o app.
 * - variante "banner": cartão dispensável (tela inicial do morador)
 * - variante "botao": item compacto (menus)
 */
export function InstalarApp({ variante = "banner", className }: { variante?: "banner" | "botao"; className?: string }) {
  const { instalado, podeInstalar, ehIOS, instalar } = usePwa()
  const [iosAberto, setIosAberto] = useState(false)
  const [dispensado, setDispensado] = useState(true)

  useEffect(() => {
    let ate = 0
    try { ate = Number(localStorage.getItem(CHAVE_DISPENSADO) ?? 0) } catch { /* sem storage */ }
    queueMicrotask(() => setDispensado(ate > Date.now()))
  }, [])

  if (instalado || (!podeInstalar && !ehIOS)) return null

  const acionar = async () => {
    if (podeInstalar) await instalar()
    else setIosAberto(true)
  }

  const dispensar = () => {
    setDispensado(true)
    try { localStorage.setItem(CHAVE_DISPENSADO, String(Date.now() + 14 * 86_400_000)) } catch { /* sem storage */ }
  }

  if (variante === "botao") {
    return (
      <>
        <button
          onClick={acionar}
          className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-primary font-medium hover:bg-primary/10 transition-colors", className)}
        >
          <Download className="w-4 h-4 shrink-0" /> Instalar o app
        </button>
        <InstrucoesIOS aberto={iosAberto} onFechar={() => setIosAberto(false)} />
      </>
    )
  }

  if (dispensado) return null

  return (
    <>
      <div className={cn("relative rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3", className)}>
        <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Instale o app ZeloH</p>
          <p className="text-xs text-muted-foreground">Acesso com um toque e avisos de encomendas no celular.</p>
        </div>
        <Button size="sm" className="rounded-xl shrink-0" onClick={acionar}>Instalar</Button>
        <button onClick={dispensar} aria-label="Dispensar" className="absolute top-1.5 right-1.5 p-1 text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <InstrucoesIOS aberto={iosAberto} onFechar={() => setIosAberto(false)} />
    </>
  )
}

"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

interface PwaContexto {
  /** Já está rodando como app instalado */
  instalado: boolean
  /** O navegador oferece instalação com um clique (Android/Chrome/Edge) */
  podeInstalar: boolean
  /** iPhone/iPad no Safari: instalação manual pelo menu Compartilhar */
  ehIOS: boolean
  instalar: () => Promise<boolean>
}

const Ctx = createContext<PwaContexto>({ instalado: false, podeInstalar: false, ehIOS: false, instalar: async () => false })

export function usePwa() {
  return useContext(Ctx)
}

/** Registra o service worker e captura o convite de instalação do navegador. */
export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null)
  const [instalado, setInstalado] = useState(false)
  const [ehIOS, setEhIOS] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)

    const aoPedir = (e: Event) => {
      e.preventDefault() // guardamos para mostrar nosso próprio botão
      setEvento(e as BeforeInstallPromptEvent)
    }
    const aoInstalar = () => { setInstalado(true); setEvento(null) }

    window.addEventListener("beforeinstallprompt", aoPedir)
    window.addEventListener("appinstalled", aoInstalar)

    // Atualiza estado fora do corpo síncrono do efeito
    queueMicrotask(() => { setInstalado(standalone); setEhIOS(ios) })

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("[pwa] service worker:", err))
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", aoPedir)
      window.removeEventListener("appinstalled", aoInstalar)
    }
  }, [])

  const instalar = useCallback(async () => {
    if (!evento) return false
    await evento.prompt()
    const { outcome } = await evento.userChoice
    setEvento(null)
    return outcome === "accepted"
  }, [evento])

  return (
    <Ctx.Provider value={{ instalado, podeInstalar: !!evento, ehIOS, instalar }}>
      {children}
    </Ctx.Provider>
  )
}

"use client"

import { useEffect, useState } from "react"
import { BellRing, BellOff } from "lucide-react"
import { toast } from "sonner"

function base64ParaUint8(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

type Estado = "carregando" | "indisponivel" | "ativo" | "inativo" | "bloqueado"

/** Botão para ativar/desativar notificações push neste aparelho. */
export function AtivarPush({ compacto = false }: { compacto?: boolean }) {
  const [estado, setEstado] = useState<Estado>("carregando")
  const [chave, setChave]   = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setEstado("indisponivel")
        return
      }
      const res = await fetch("/api/push").then((r) => r.json()).catch(() => ({ publicKey: null }))
      if (cancelado) return
      if (!res.publicKey) { setEstado("indisponivel"); return }
      setChave(res.publicKey)
      if (Notification.permission === "denied") { setEstado("bloqueado"); return }
      const reg = await navigator.serviceWorker.register("/sw.js")
      const sub = await reg.pushManager.getSubscription()
      if (!cancelado) setEstado(sub ? "ativo" : "inativo")
    })()
    return () => { cancelado = true }
  }, [])

  const ativar = async () => {
    if (!chave) return
    try {
      const permissao = await Notification.requestPermission()
      if (permissao !== "granted") { setEstado("bloqueado"); return }
      const reg = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ParaUint8(chave),
      })
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) throw new Error()
      setEstado("ativo")
      toast.success("Notificações ativadas neste aparelho")
    } catch {
      toast.error("Não foi possível ativar as notificações")
    }
  }

  const desativar = async () => {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js")
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await fetch(`/api/push?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: "DELETE" })
      await sub.unsubscribe()
    }
    setEstado("inativo")
    toast.success("Notificações desativadas neste aparelho")
  }

  if (estado === "carregando" || estado === "indisponivel") return null

  if (estado === "bloqueado") {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <BellOff className="w-3.5 h-3.5" /> Notificações bloqueadas no navegador
      </p>
    )
  }

  return (
    <button
      onClick={estado === "ativo" ? desativar : ativar}
      className={
        compacto
          ? "flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          : "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent/60 transition-colors"
      }
    >
      {estado === "ativo" ? <BellOff className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
      {estado === "ativo" ? "Desativar notificações no celular" : "Receber notificações no celular"}
    </button>
  )
}

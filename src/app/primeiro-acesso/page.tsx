"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound, Loader2, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/layout/logo"

function PrimeiroAcessoForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const setupToken   = searchParams.get("token") ?? ""

  const [senha, setSenha]           = useState("")
  const [confirma, setConfirma]     = useState("")
  const [mostrar, setMostrar]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [erro, setErro]             = useState("")

  useEffect(() => {
    if (!setupToken) router.replace("/login")
  }, [setupToken, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro("")

    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.")
      return
    }
    if (senha !== confirma) {
      setErro("As senhas não conferem.")
      return
    }

    setLoading(true)
    try {
      const res  = await fetch("/api/auth/primeiro-acesso", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ setupToken, senha }),
      })
      const json = await res.json()

      if (res.ok) {
        router.replace("/dashboard")
      } else {
        setErro(json.message ?? "Erro ao definir senha.")
      }
    } catch {
      setErro("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <Logo size="md" />
          <div className="text-center">
            <h1 className="font-heading text-xl font-semibold text-foreground">
              Bem-vindo ao ZeloH
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Defina sua senha para ativar o acesso
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3 pb-1">
            <div className="rounded-full bg-primary/10 p-2">
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Crie uma senha segura para acessar sua conta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="senha">Nova senha</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={mostrar ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setMostrar((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirma">Confirmar senha</Label>
              <Input
                id="confirma"
                type={mostrar ? "text" : "password"}
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                placeholder="Repita a senha"
                required
              />
            </div>

            {/* Indicador de força */}
            {senha && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        senha.length >= n * 4
                          ? n === 1 ? "bg-red-400" : n === 2 ? "bg-amber-400" : "bg-green-500"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {senha.length < 4 ? "Fraca" : senha.length < 8 ? "Média" : "Forte"}
                </p>
              </div>
            )}

            {erro && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {erro}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Ativar minha conta
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function PrimeiroAcessoPage() {
  return (
    <Suspense>
      <PrimeiroAcessoForm />
    </Suspense>
  )
}

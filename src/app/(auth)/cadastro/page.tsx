"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/layout/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Eye, EyeOff, Loader2 } from "lucide-react"

export default function CadastroPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    nome: "",
    email: "",
    password: "",
    condominioNome: "",
    condominioCnpj: "",
  })

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? "Erro ao cadastrar")
      router.push("/dashboard")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <Card className="p-6 space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-heading font-bold text-foreground">
              Cadastre seu condomínio
            </h1>
            <p className="text-sm text-muted-foreground">
              Comece a centralizar a gestão agora
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dados do síndico */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Seus dados
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="nome" className="text-xs font-medium">Nome completo</Label>
                <Input id="nome" placeholder="Renato Pacheco" value={form.nome}
                  onChange={(e) => update("nome", e.target.value)} required className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">E-mail</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={form.email}
                  onChange={(e) => update("email", e.target.value)} required className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">Senha</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres" value={form.password}
                    onChange={(e) => update("password", e.target.value)} required className="h-10 pr-10" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Dados do condomínio */}
            <div className="space-y-3 pt-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Condomínio
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="condominioNome" className="text-xs font-medium">Nome do condomínio</Label>
                <Input id="condominioNome" placeholder="Residencial Vila das Palmeiras"
                  value={form.condominioNome} onChange={(e) => update("condominioNome", e.target.value)}
                  required className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="condominioCnpj" className="text-xs font-medium">
                  CNPJ <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Input id="condominioCnpj" placeholder="00.000.000/0001-00"
                  value={form.condominioCnpj} onChange={(e) => update("condominioCnpj", e.target.value)}
                  className="h-10" />
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cadastrando...</>
              ) : (
                "Criar conta"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Fazer login
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}

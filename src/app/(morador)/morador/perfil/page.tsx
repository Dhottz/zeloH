"use client"

import { useState } from "react"
import {
  User, Mail, Building2, LogOut, Lock, Eye, EyeOff,
  CheckCircle2, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

function InfoRow({ icon, label, value }: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-primary">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value || "–"}</p>
      </div>
    </div>
  )
}

function PasswordStrength({ senha }: { senha: string }) {
  const checks = [
    senha.length >= 8,
    /[A-Z]/.test(senha),
    /[0-9]/.test(senha),
  ]
  const score = checks.filter(Boolean).length
  const colors = ["bg-red-400", "bg-amber-400", "bg-green-500"]
  const labels = ["Fraca", "Média", "Forte"]
  if (!senha) return null
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex gap-1 flex-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < score ? colors[score - 1] : "bg-muted"
            )}
          />
        ))}
      </div>
      <span className={cn("text-[10px] font-medium", score < 2 ? "text-red-500" : score < 3 ? "text-amber-500" : "text-green-600")}>
        {labels[score - 1] ?? "Fraca"}
      </span>
    </div>
  )
}

export default function MoradorPerfilPage() {
  const { usuario, logout } = useAuth()

  // Modal de senha
  const [modalSenha, setModalSenha]     = useState(false)
  const [senhaAtual, setSenhaAtual]     = useState("")
  const [novaSenha, setNovaSenha]       = useState("")
  const [confirmar, setConfirmar]       = useState("")
  const [mostrar, setMostrar]           = useState(false)
  const [saving, setSaving]             = useState(false)
  const [erro, setErro]                 = useState("")
  const [sucesso, setSucesso]           = useState(false)

  const identificacao = [
    usuario?.bloco   && `Bloco ${usuario.bloco}`,
    usuario?.unidade && `Apto ${usuario.unidade}`,
  ].filter(Boolean).join(" · ")

  async function handleAlterarSenha() {
    if (!senhaAtual || !novaSenha || !confirmar) { setErro("Preencha todos os campos"); return }
    if (novaSenha !== confirmar) { setErro("As senhas não coincidem"); return }
    if (novaSenha.length < 8)   { setErro("A senha deve ter ao menos 8 caracteres"); return }

    setSaving(true); setErro(""); setSucesso(false)
    try {
      const res = await fetch("/api/auth/alterar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.message ?? "Erro ao alterar senha"); return }
      setSucesso(true)
      setTimeout(() => {
        setModalSenha(false)
        setSenhaAtual(""); setNovaSenha(""); setConfirmar(""); setSucesso(false)
      }, 1500)
    } catch {
      setErro("Erro ao alterar senha")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-primary px-5 pt-6 pb-8 flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-primary-foreground/20 flex items-center justify-center mb-3">
          <span className="text-primary-foreground text-2xl font-bold">
            {usuario?.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
          </span>
        </div>
        <h1 className="text-primary-foreground text-xl font-bold font-heading">{usuario?.nome}</h1>
        {identificacao && (
          <p className="text-primary-foreground/70 text-sm mt-0.5">{identificacao}</p>
        )}
        <p className="text-primary-foreground/60 text-xs mt-0.5">Morador</p>
      </div>

      {/* Informações */}
      <div className="px-4 mt-4">
        <div className="bg-background rounded-2xl border border-border px-4">
          <InfoRow
            icon={<User className="w-4 h-4" />}
            label="Nome completo"
            value={usuario?.nome}
          />
          <InfoRow
            icon={<Mail className="w-4 h-4" />}
            label="E-mail"
            value={usuario?.email}
          />
          <InfoRow
            icon={<Building2 className="w-4 h-4" />}
            label="Condomínio"
            value={usuario?.condominio?.nome}
          />
        </div>
      </div>

      {/* Ações */}
      <div className="px-4 mt-4 flex flex-col gap-3">
        <button
          onClick={() => setModalSenha(true)}
          className="flex items-center gap-3 bg-background rounded-2xl border border-border px-4 py-3.5 text-left w-full hover:bg-accent/30 transition-colors"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Alterar senha</p>
            <p className="text-xs text-muted-foreground">Atualize sua senha de acesso</p>
          </div>
        </button>

        <button
          onClick={logout}
          className="flex items-center gap-3 bg-background rounded-2xl border border-red-200 px-4 py-3.5 text-left w-full hover:bg-red-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-red-700">Sair</p>
            <p className="text-xs text-muted-foreground">Encerrar sessão</p>
          </div>
        </button>
      </div>

      {/* App version */}
      <p className="text-center text-[10px] text-muted-foreground/50 mt-8">
        ZeloH · App do Morador
      </p>

      {/* Modal de Senha */}
      <Dialog open={modalSenha} onOpenChange={setModalSenha}>
        <DialogContent className="max-w-[95vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {sucesso ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
                <p className="text-sm font-medium text-foreground">Senha alterada com sucesso!</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="sa" className="text-sm font-medium">Senha atual *</Label>
                  <div className="relative">
                    <Input
                      id="sa"
                      type={mostrar ? "text" : "password"}
                      value={senhaAtual}
                      onChange={(e) => setSenhaAtual(e.target.value)}
                      className="rounded-xl pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrar((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ns" className="text-sm font-medium">Nova senha *</Label>
                  <Input
                    id="ns"
                    type={mostrar ? "text" : "password"}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    className="rounded-xl"
                  />
                  <PasswordStrength senha={novaSenha} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cs" className="text-sm font-medium">Confirmar nova senha *</Label>
                  <Input
                    id="cs"
                    type={mostrar ? "text" : "password"}
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    className="rounded-xl"
                  />
                  {confirmar && novaSenha !== confirmar && (
                    <p className="text-xs text-red-600">As senhas não coincidem</p>
                  )}
                </div>

                {erro && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {erro}
                  </p>
                )}
              </>
            )}
          </div>

          {!sucesso && (
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setModalSenha(false)} className="rounded-xl">
                Cancelar
              </Button>
              <Button onClick={handleAlterarSenha} disabled={saving} className="rounded-xl">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Alterar senha
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

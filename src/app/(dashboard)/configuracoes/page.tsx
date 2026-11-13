"use client"

import { useEffect, useRef, useState } from "react"
import {
  Building2, Save, Loader2, Link2, Link2Off, RefreshCw, CheckCircle2,
  Sparkles, Upload, Trash2, FileText, FilePlus, File, Calendar,
  HardDrive, AlertCircle, Plus, X, Layers,
} from "lucide-react"
import { Button }      from "@/components/ui/button"
import { Input }       from "@/components/ui/input"
import { Label }       from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge }       from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn }          from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CondominioData {
  id: string; nome: string; cnpj: string | null; email: string | null
  telefone: string | null; endereco: string | null; cidade: string | null
  estado: string | null; cep: string | null; visttoClientId: string | null
  blocos: string[]
}

type DocumentoTipo = "CONTRATO" | "ATA" | "REGULAMENTO" | "PROCURACAO" | "OUTRO"

interface Documento {
  id: string; nome: string; tipo: DocumentoTipo
  tamanho: number | null; createdAt: string; uploadadoPor: string | null
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TIPO_DOC: Record<DocumentoTipo, { label: string; color: string }> = {
  CONTRATO:    { label: "Contrato",    color: "bg-blue-50 text-blue-700 border-blue-200" },
  ATA:         { label: "Ata",         color: "bg-purple-50 text-purple-700 border-purple-200" },
  REGULAMENTO: { label: "Regulamento", color: "bg-orange-50 text-orange-700 border-orange-200" },
  PROCURACAO:  { label: "Procuração",  color: "bg-pink-50 text-pink-700 border-pink-200" },
  OUTRO:       { label: "Outro",       color: "bg-gray-50 text-gray-700 border-gray-200" },
}

function fmtBytes(bytes: number | null) {
  if (!bytes) return "–"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  // ── Condomínio ──────────────────────────────────────────────────────────────
  const [dados, setDados]     = useState<CondominioData | null>(null)
  const [form, setForm]       = useState<Partial<CondominioData>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [vinculando, setVinculando] = useState(false)

  // ── Regimento ───────────────────────────────────────────────────────────────
  const [regimento, setRegimento]               = useState("")
  const [regimentoOriginal, setRegimentoOriginal] = useState("")
  const [savingReg, setSavingReg]               = useState(false)
  const [uploadingPdf, setUploadingPdf]         = useState(false)

  // ── Blocos ──────────────────────────────────────────────────────────────────
  const [blocos, setBlocos]           = useState<string[]>([])
  const [novoBloco, setNovoBloco]     = useState("")
  const [salvandoBlocos, setSalvandoBlocos] = useState(false)

  // ── Documentos ──────────────────────────────────────────────────────────────
  const [documentos, setDocumentos]       = useState<Documento[]>([])
  const [loadingDocs, setLoadingDocs]     = useState(false)
  const [uploadingDoc, setUploadingDoc]   = useState(false)
  const [novoNome, setNovoNome]           = useState("")
  const [novoTipo, setNovoTipo]           = useState<DocumentoTipo>("CONTRATO")
  const [deletingId, setDeletingId]       = useState<string | null>(null)
  const fileDocRef = useRef<HTMLInputElement>(null)

  // ── Feedback global ─────────────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<{ type: "ok" | "erro"; text: string } | null>(null)
  const showFeedback = (type: "ok" | "erro", text: string) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4000)
  }

  // ── Carga inicial ───────────────────────────────────────────────────────────
  useEffect(() => {
    const safeJson = async (res: Response) => {
      const ct = res.headers.get("content-type") ?? ""
      if (!ct.includes("application/json")) return {}
      return res.json().catch(() => ({}))
    }

    Promise.all([
      fetch("/api/condominio").then(safeJson),
      fetch("/api/condominio/regimento").then(safeJson),
    ]).then(([data, reg]) => {
      if (data.id) {
        setDados(data)
        setForm({
          nome: data.nome ?? "", cnpj: data.cnpj ? formatCnpj(data.cnpj) : "",
          email: data.email ?? "", telefone: data.telefone ?? "",
          endereco: data.endereco ?? "", cidade: data.cidade ?? "",
          estado: data.estado ?? "", cep: data.cep ?? "",
        })
        setBlocos(data.blocos ?? [])
      }
      const txt = reg.regimento ?? ""
      setRegimento(txt); setRegimentoOriginal(txt)
    }).catch(console.error).finally(() => setLoading(false))

    // Carrega documentos
    carregarDocumentos()
  }, [])

  // ── Handlers condomínio ─────────────────────────────────────────────────────
  const handleChange = (field: keyof CondominioData, value: string) => {
    setForm(prev => ({ ...prev, [field]: field === "cnpj" ? formatCnpj(value) : value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res  = await fetch("/api/condominio", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, cnpj: form.cnpj?.replace(/\D/g, "") || null }),
      })
      const json = await res.json()
      if (res.ok) {
        setDados(json)
        setForm(prev => ({ ...prev, cnpj: json.cnpj ? formatCnpj(json.cnpj) : "" }))
        showFeedback("ok", "Dados salvos com sucesso!")
      } else { showFeedback("erro", json.message ?? "Erro ao salvar.") }
    } catch { showFeedback("erro", "Erro de conexão.") }
    finally  { setSaving(false) }
  }

  const handleVincular = async () => {
    if (form.cnpj?.replace(/\D/g, "") !== dados?.cnpj) await handleSave()
    setVinculando(true)
    try {
      const res  = await fetch("/api/vistto/vincular", { method: "POST" })
      const json = await res.json()
      if (res.ok) { setDados(prev => prev ? { ...prev, visttoClientId: json.visttoClientId } : prev); showFeedback("ok", json.message) }
      else          showFeedback("erro", json.message ?? "Erro ao vincular.")
    } catch { showFeedback("erro", "Erro de conexão com o servidor.") }
    finally  { setVinculando(false) }
  }

  const handleDesvincular = async () => {
    setVinculando(true)
    try {
      const res  = await fetch("/api/vistto/vincular", { method: "DELETE" })
      const json = await res.json()
      if (res.ok) { setDados(prev => prev ? { ...prev, visttoClientId: null } : prev); showFeedback("ok", json.message) }
      else          showFeedback("erro", json.message ?? "Erro ao desvincular.")
    } catch { showFeedback("erro", "Erro de conexão.") }
    finally  { setVinculando(false) }
  }

  // ── Handlers blocos ─────────────────────────────────────────────────────────
  const salvarBlocos = async (novaLista: string[]) => {
    setSalvandoBlocos(true)
    try {
      const res = await fetch("/api/condominio", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocos: novaLista }),
      })
      if (res.ok) { setBlocos(novaLista); showFeedback("ok", "Blocos salvos!") }
      else showFeedback("erro", "Erro ao salvar blocos.")
    } catch { showFeedback("erro", "Erro de conexão.") }
    finally { setSalvandoBlocos(false) }
  }

  const adicionarBloco = () => {
    const nome = novoBloco.trim()
    if (!nome || blocos.includes(nome)) return
    setNovoBloco("")
    salvarBlocos([...blocos, nome])
  }

  const removerBloco = (bloco: string) => salvarBlocos(blocos.filter(b => b !== bloco))

  // ── Handlers regimento ──────────────────────────────────────────────────────
  const handleSaveRegimento = async () => {
    setSavingReg(true)
    try {
      const res = await fetch("/api/condominio/regimento", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regimento: regimento || null }),
      })
      if (res.ok) { setRegimentoOriginal(regimento); showFeedback("ok", "Regimento salvo! A ZileIA já pode usar esse conteúdo.") }
      else { const json = await res.json(); showFeedback("erro", json.message ?? "Erro ao salvar.") }
    } catch { showFeedback("erro", "Erro de conexão.") }
    finally  { setSavingReg(false) }
  }

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPdf(true)
    try {
      const fd = new FormData(); fd.append("file", file)
      const res  = await fetch("/api/condominio/regimento/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (res.ok) {
        const reg = await fetch("/api/condominio/regimento").then(r => r.json())
        const txt = reg.regimento ?? ""; setRegimento(txt); setRegimentoOriginal(txt)
        showFeedback("ok", `PDF processado! ${json.caracteres.toLocaleString()} caracteres extraídos.`)
      } else showFeedback("erro", json.message ?? "Erro ao processar PDF.")
    } catch { showFeedback("erro", "Erro ao enviar arquivo.") }
    finally  { setUploadingPdf(false); e.target.value = "" }
  }

  // ── Handlers documentos ─────────────────────────────────────────────────────
  async function carregarDocumentos() {
    setLoadingDocs(true)
    try {
      const res  = await fetch("/api/condominio/documentos")
      const json = await res.json()
      if (res.ok) setDocumentos(json.documentos ?? [])
    } catch { /* silencioso */ }
    finally  { setLoadingDocs(false) }
  }

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDoc(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("nome", novoNome || file.name.replace(/\.pdf$/i, ""))
      fd.append("tipo", novoTipo)
      const res  = await fetch("/api/condominio/documentos", { method: "POST", body: fd })
      const json = await res.json()
      if (res.ok) {
        showFeedback("ok", `Documento enviado! ${json.caracteres?.toLocaleString() ?? 0} caracteres extraídos.`)
        setNovoNome(""); setDocumentos(prev => [json.documento, ...prev])
      } else showFeedback("erro", json.message ?? "Erro ao enviar documento.")
    } catch { showFeedback("erro", "Erro ao enviar arquivo.") }
    finally  { setUploadingDoc(false); e.target.value = "" }
  }

  const handleDeleteDoc = async (id: string) => {
    setDeletingId(id)
    try {
      const res  = await fetch(`/api/condominio/documentos/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (res.ok) { setDocumentos(prev => prev.filter(d => d.id !== id)); showFeedback("ok", json.message) }
      else          showFeedback("erro", json.message ?? "Erro ao excluir.")
    } catch { showFeedback("erro", "Erro de conexão.") }
    finally  { setDeletingId(null) }
  }

  // ─── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Dados do condomínio, integrações e documentos</p>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={cn(
          "rounded-lg px-4 py-3 text-sm font-medium border",
          feedback.type === "ok"
            ? "bg-green-50 text-green-800 border-green-200"
            : "bg-red-50 text-red-800 border-red-200"
        )}>
          {feedback.text}
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="geral">
        <TabsList className="mb-2">
          <TabsTrigger value="geral">
            <Building2 className="w-3.5 h-3.5" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <FileText className="w-3.5 h-3.5" />
            Documentos
          </TabsTrigger>
        </TabsList>

        {/* ── Aba Geral ──────────────────────────────────────────────────────── */}
        <TabsContent value="geral">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

            {/* Coluna esquerda */}
            <div className="space-y-6">

              {/* Dados do condomínio */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4" /> Dados do Condomínio
                  </CardTitle>
                  <CardDescription>
                    Informações básicas do condomínio. O CNPJ é necessário para vincular ao VISTTO.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome">Nome do condomínio</Label>
                    <Input id="nome" value={form.nome ?? ""} onChange={e => handleChange("nome", e.target.value)} placeholder="Ex: Residencial Jardins" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cnpj">CNPJ <span className="text-muted-foreground font-normal">(necessário para integração VISTTO)</span></Label>
                    <Input id="cnpj" value={form.cnpj ?? ""} onChange={e => handleChange("cnpj", e.target.value)} placeholder="00.000.000/0000-00" maxLength={18} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">E-mail</Label>
                      <Input id="email" type="email" value={form.email ?? ""} onChange={e => handleChange("email", e.target.value)} placeholder="contato@condominio.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input id="telefone" value={form.telefone ?? ""} onChange={e => handleChange("telefone", e.target.value)} placeholder="(11) 99999-9999" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input id="endereco" value={form.endereco ?? ""} onChange={e => handleChange("endereco", e.target.value)} placeholder="Rua, número, complemento" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="cep">CEP</Label>
                      <Input id="cep" value={form.cep ?? ""} onChange={e => handleChange("cep", e.target.value)} placeholder="00000-000" maxLength={9} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cidade">Cidade</Label>
                      <Input id="cidade" value={form.cidade ?? ""} onChange={e => handleChange("cidade", e.target.value)} placeholder="São Paulo" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="estado">Estado</Label>
                      <Input id="estado" value={form.estado ?? ""} onChange={e => handleChange("estado", e.target.value)} placeholder="SP" maxLength={2} />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar alterações
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Blocos do Condomínio */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Layers className="h-4 w-4" /> Blocos do Condomínio
                  </CardTitle>
                  <CardDescription>
                    Defina os blocos. Eles serão usados para filtrar e organizar moradores.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 min-h-[36px]">
                    {blocos.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic self-center">Nenhum bloco configurado</p>
                    ) : blocos.map(b => (
                      <span key={b} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-muted text-sm font-medium">
                        {b}
                        <button onClick={() => removerBloco(b)} disabled={salvandoBlocos} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome do bloco (ex: A, B, Torre 1...)"
                      value={novoBloco}
                      onChange={e => setNovoBloco(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && adicionarBloco()}
                      className="h-9 text-sm max-w-xs"
                    />
                    <Button size="sm" variant="outline" onClick={adicionarBloco} disabled={salvandoBlocos || !novoBloco.trim()}>
                      {salvandoBlocos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Adicionar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Integração VISTTO */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <RefreshCw className="h-4 w-4" /> Integração VISTTO
                  </CardTitle>
                  <CardDescription>
                    Vincula este condomínio ao VISTTO pelo CNPJ para sincronizar ordens de serviço automaticamente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 border">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">Status da conexão</p>
                      <p className="text-xs text-muted-foreground">{dados?.visttoClientId ? `ID: ${dados.visttoClientId}` : "Não vinculado"}</p>
                    </div>
                    <Badge variant={dados?.visttoClientId ? "default" : "outline"}>
                      {dados?.visttoClientId
                        ? <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Conectado</span>
                        : "Desconectado"}
                    </Badge>
                  </div>
                  {!dados?.cnpj && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      ⚠️ Preencha e salve o CNPJ acima antes de vincular ao VISTTO.
                    </p>
                  )}
                  <div className="flex gap-2">
                    {dados?.visttoClientId ? (
                      <Button variant="outline" onClick={handleDesvincular} disabled={vinculando} className="text-destructive hover:text-destructive">
                        {vinculando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2Off className="h-4 w-4 mr-2" />}
                        Desvincular
                      </Button>
                    ) : (
                      <Button onClick={handleVincular} disabled={vinculando || !dados?.cnpj}>
                        {vinculando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                        Vincular ao VISTTO
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>{/* fim coluna esquerda */}

            {/* Coluna direita — ZileIA */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" /> Base de Conhecimento da ZileIA
                </CardTitle>
                <CardDescription>
                  O regimento aqui cadastrado será usado pela ZileIA para responder dúvidas dos moradores no app.
                  Cole o texto diretamente ou faça upload de um PDF.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Regimento</p>
                      <p className="text-xs text-muted-foreground">
                        {regimentoOriginal ? `${regimentoOriginal.length.toLocaleString()} caracteres cadastrados` : "Nenhum regimento cadastrado"}
                      </p>
                    </div>
                  </div>
                  <Badge variant={regimentoOriginal ? "default" : "outline"}>
                    {regimentoOriginal ? <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Ativo</span> : "Sem conteúdo"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input type="file" accept=".pdf" className="hidden" onChange={handleUploadPdf} disabled={uploadingPdf} />
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-sm text-muted-foreground">
                      {uploadingPdf
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Extraindo texto...</>
                        : <><Upload className="h-4 w-4" /> Importar PDF do regimento</>}
                    </div>
                  </label>
                  <p className="text-xs text-muted-foreground">PDF com texto selecionável, máx. 10MB</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="regimento">
                    Texto do regimento
                    {regimento !== regimentoOriginal && (
                      <span className="ml-2 text-amber-600 font-normal text-xs">• alterações não salvas</span>
                    )}
                  </Label>
                  <textarea
                    id="regimento"
                    value={regimento}
                    onChange={e => setRegimento(e.target.value)}
                    placeholder="Cole aqui o regimento interno do condomínio. A ZileIA usará este texto para responder perguntas dos moradores."
                    rows={20}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[200px]"
                  />
                </div>

                <div className="flex items-center justify-between">
                  {regimento && (
                    <button onClick={() => setRegimento("")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" /> Limpar texto
                    </button>
                  )}
                  <div className="ml-auto">
                    <Button onClick={handleSaveRegimento} disabled={savingReg || regimento === regimentoOriginal}>
                      {savingReg
                        ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
                        : <><Save className="h-4 w-4 mr-2" /> Salvar regimento</>}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {/* ── Aba Documentos ─────────────────────────────────────────────────── */}
        <TabsContent value="documentos">
          <div className="space-y-6">

            {/* Upload de novo documento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FilePlus className="h-4 w-4 text-primary" /> Adicionar Documento
                </CardTitle>
                <CardDescription>
                  Contratos, atas, regulamentos e outros documentos. A ZileIA pode consultá-los quando o síndico conversar com ela.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Nome */}
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="doc-nome">Nome do documento</Label>
                    <Input
                      id="doc-nome"
                      value={novoNome}
                      onChange={e => setNovoNome(e.target.value)}
                      placeholder="Ex: Contrato de Limpeza 2024"
                    />
                  </div>

                  {/* Tipo */}
                  <div className="w-full sm:w-44 space-y-1.5">
                    <Label htmlFor="doc-tipo">Tipo</Label>
                    <select
                      id="doc-tipo"
                      value={novoTipo}
                      onChange={e => setNovoTipo(e.target.value as DocumentoTipo)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {Object.entries(TIPO_DOC).map(([v, { label }]) => (
                        <option key={v} value={v}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Upload */}
                  <div className="flex items-end">
                    <input type="file" accept=".pdf" className="hidden" ref={fileDocRef} onChange={handleUploadDoc} disabled={uploadingDoc} />
                    <Button
                      onClick={() => fileDocRef.current?.click()}
                      disabled={uploadingDoc}
                      className="w-full sm:w-auto"
                    >
                      {uploadingDoc
                        ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processando...</>
                        : <><Upload className="h-4 w-4 mr-2" /> Enviar PDF</>}
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Apenas PDFs com texto selecionável são suportados. Máx. 10 MB por arquivo.
                </div>
              </CardContent>
            </Card>

            {/* Lista de documentos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <File className="h-4 w-4" />
                  Documentos cadastrados
                  {documentos.length > 0 && (
                    <Badge variant="outline" className="ml-auto font-normal">{documentos.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingDocs ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : documentos.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhum documento cadastrado</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Envie contratos, atas e regulamentos acima</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {documentos.map(doc => {
                      const cfg = TIPO_DOC[doc.tipo] ?? TIPO_DOC.OUTRO
                      return (
                        <div key={doc.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{doc.nome}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <Badge className={cn("text-[10px] border", cfg.color)}>{cfg.label}</Badge>
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <HardDrive className="w-3 h-3" />{fmtBytes(doc.tamanho)}
                              </span>
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />{fmtData(doc.createdAt)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            disabled={deletingId === doc.id}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors shrink-0"
                          >
                            {deletingId === doc.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Nota sobre acesso da ZileIA */}
            <div className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Como a ZileIA usa esses documentos</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  A ZileIA tem acesso ao conteúdo dos documentos cadastrados aqui, mas <strong>somente quando conversa com o síndico</strong>.
                  Moradores não têm acesso a essas informações — eles podem consultar apenas o regimento e os comunicados publicados.
                </p>
              </div>
            </div>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

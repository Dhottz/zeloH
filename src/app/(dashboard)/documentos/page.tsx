"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FolderOpen, Upload, Loader2, FileText, History, Download, Trash2, Search, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { PageHeader, EstadoVazio, Pilulas } from "@/components/shared/page-header"
import { ModuloGate } from "@/components/shared/modulo-gate"
import { useAuth } from "@/hooks/use-auth"
import { podeGerenciar } from "@/lib/permissions"
import { urlArquivo } from "@/lib/arquivos"
import { cn, formatDate, formatDateTime } from "@/lib/utils"

interface Documento {
  id: string
  nome: string
  tipo: string
  tamanho: number | null
  createdAt: string
  arquivo: string | null
  grupoId: string | null
  versao: number
  atual: boolean
  autorNome: string | null
}

const TIPOS: { valor: string; rotulo: string }[] = [
  { valor: "CONVENCAO", rotulo: "Convenção" },
  { valor: "REGULAMENTO", rotulo: "Regimento interno" },
  { valor: "ATA", rotulo: "Ata de assembleia" },
  { valor: "PRESTACAO_CONTAS", rotulo: "Prestação de contas" },
  { valor: "CONTRATO", rotulo: "Contrato" },
  { valor: "MANUAL", rotulo: "Manual / procedimento" },
  { valor: "PROCURACAO", rotulo: "Procuração" },
  { valor: "OUTRO", rotulo: "Outro" },
]
const rotuloTipo = (v: string) => TIPOS.find((t) => t.valor === v)?.rotulo ?? v

function tamanho(bytes: number | null) {
  if (!bytes) return ""
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

function Conteudo() {
  const { usuario } = useAuth()
  const podeEnviar = podeGerenciar(usuario?.role) || usuario?.role === "ZELADOR"
  const podeExcluir = podeGerenciar(usuario?.role)
  const [docs, setDocs] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState("")
  const [busca, setBusca] = useState("")
  const [upload, setUpload] = useState<{ aberto: boolean; grupo: Documento | null }>({ aberto: false, grupo: null })
  const [form, setForm] = useState({ nome: "", tipo: "ATA" })
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [versoes, setVersoes] = useState<{ doc: Documento; lista: Documento[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const carregar = useCallback(async () => {
    const res = await fetch("/api/condominio/documentos")
    if (res.ok) setDocs((await res.json()).documentos)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const abrirVersoes = async (d: Documento) => {
    const res = await fetch(`/api/condominio/documentos?grupoId=${d.grupoId ?? d.id}`)
    if (res.ok) setVersoes({ doc: d, lista: (await res.json()).documentos })
  }

  const enviar = async () => {
    if (!arquivo) return
    setEnviando(true)
    const fd = new FormData()
    fd.append("file", arquivo)
    if (upload.grupo) fd.append("grupoId", upload.grupo.grupoId ?? upload.grupo.id)
    else { fd.append("nome", form.nome); fd.append("tipo", form.tipo) }
    const res = await fetch("/api/condominio/documentos", { method: "POST", body: fd })
    const data = await res.json()
    setEnviando(false)
    if (!res.ok) { toast.error(data.message ?? "Erro no envio"); return }
    toast.success(upload.grupo ? `Versão ${data.documento.versao} enviada` : "Documento enviado", {
      description: data.caracteres ? "Texto lido pela Zia — ela já pode responder sobre ele." : undefined,
    })
    setUpload({ aberto: false, grupo: null })
    setArquivo(null)
    setForm({ nome: "", tipo: "ATA" })
    setVersoes(null)
    carregar()
  }

  const excluir = async (d: Documento) => {
    if (!confirm(`Excluir "${d.nome}" (versão ${d.versao})?`)) return
    const res = await fetch(`/api/condominio/documentos/${d.id}`, { method: "DELETE" })
    if (res.ok) { toast.success("Excluído"); setVersoes(null); carregar() }
  }

  const visiveis = docs.filter((d) =>
    (!filtro || d.tipo === filtro) && (!busca || d.nome.toLowerCase().includes(busca.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Documentos e governança"
        descricao="Convenção, regimento, atas, prestações de contas e manuais — com histórico de versões."
        acoes={podeEnviar && <Button size="sm" onClick={() => setUpload({ aberto: true, grupo: null })}><Upload className="h-4 w-4 mr-2" />Enviar documento</Button>}
      />

      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <span>Os PDFs enviados aqui viram base de conhecimento da Zia: ela responde dúvidas citando o regimento, atas e contratos.</span>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar documento..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Pilulas
          valor={filtro}
          onChange={setFiltro}
          opcoes={[{ valor: "", rotulo: "Todos" }, ...TIPOS.filter((t) => docs.some((d) => d.tipo === t.valor)).map((t) => ({ valor: t.valor, rotulo: t.rotulo }))]}
        />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : visiveis.length === 0 ? (
        <EstadoVazio icone={FolderOpen} titulo="Nenhum documento" descricao="Envie a convenção, o regimento e as atas para centralizar a governança do condomínio." />
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {visiveis.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3">
              <div className="rounded-lg bg-primary/10 p-2 shrink-0"><FileText className="h-4 w-4 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {rotuloTipo(d.tipo)} · v{d.versao} · {formatDate(d.createdAt)}{d.autorNome ? ` · ${d.autorNome}` : ""} {tamanho(d.tamanho) && `· ${tamanho(d.tamanho)}`}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => abrirVersoes(d)} title="Histórico de versões"><History className="h-4 w-4" /></Button>
              {d.arquivo && (
                <a href={urlArquivo(d.arquivo)} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="ghost" title="Baixar"><Download className="h-4 w-4" /></Button>
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Envio */}
      <Dialog open={upload.aberto} onOpenChange={(o) => !o && setUpload({ aberto: false, grupo: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{upload.grupo ? `Nova versão de "${upload.grupo.nome}"` : "Enviar documento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {!upload.grupo && (
              <>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <NativeSelect value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                    {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Ata da AGO de março/2026" />
                </div>
              </>
            )}
            <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn("w-full rounded-xl border-2 border-dashed px-4 py-6 text-sm text-center transition-colors", arquivo ? "border-primary text-foreground" : "border-border text-muted-foreground hover:border-primary")}
            >
              {arquivo ? `${arquivo.name} (${tamanho(arquivo.size)})` : "Clique para escolher o PDF ou imagem (até 10 MB)"}
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpload({ aberto: false, grupo: null })}>Cancelar</Button>
            <Button onClick={enviar} disabled={enviando || !arquivo}>
              {enviando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{enviando ? "Lendo documento..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Versões */}
      <Dialog open={!!versoes} onOpenChange={(o) => !o && setVersoes(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Versões de &ldquo;{versoes?.doc.nome}&rdquo;</DialogTitle></DialogHeader>
          <div className="divide-y divide-border">
            {versoes?.lista.map((v) => (
              <div key={v.id} className="flex items-center gap-3 py-2.5">
                <span className={cn("text-xs font-semibold rounded-full px-2 py-0.5", v.atual ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground")}>v{v.versao}</span>
                <div className="flex-1 min-w-0 text-xs">
                  <p>{formatDateTime(v.createdAt)}</p>
                  <p className="text-muted-foreground">{v.autorNome ?? "—"}{v.atual ? " · vigente" : ""}</p>
                </div>
                {v.arquivo && <a href={urlArquivo(v.arquivo)} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button></a>}
                {podeExcluir && <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => excluir(v)}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ))}
          </div>
          {podeEnviar && versoes && (
            <DialogFooter>
              <Button size="sm" onClick={() => { setUpload({ aberto: true, grupo: versoes.doc }); setVersoes(null) }}>
                <Upload className="h-4 w-4 mr-2" />Enviar nova versão
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function DocumentosPage() {
  return <ModuloGate modulo="documentos"><Conteudo /></ModuloGate>
}

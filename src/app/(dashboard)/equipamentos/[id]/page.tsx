"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Cog, Pencil, Plus, Printer, Wrench, MapPin, ShieldCheck, Calendar, Hash, FileSignature,
  FileBadge, AlertCircle, CheckCircle2, Trash2, Wallet,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Pilulas, EstadoVazio } from "@/components/shared/page-header"
import { ModuloGate } from "@/components/shared/modulo-gate"
import { GaleriaArquivos } from "@/components/shared/arquivos-input"
import { EquipamentoForm, type EquipamentoBase } from "@/components/equipamentos/equipamento-form"
import { ManutencaoForm } from "@/components/manutencoes/manutencao-form"
import { ManutencaoDetalhe } from "@/components/manutencoes/manutencao-detalhe"
import { PlanosPreventivos } from "@/components/manutencoes/planos-preventivos"
import { STATUS_CONFIG, TIPO_CONFIG, estaAtrasada, type Manutencao } from "@/components/manutencoes/tipos"
import { useAuth } from "@/hooks/use-auth"
import { podeGerenciar, podeOperar } from "@/lib/permissions"
import { rotuloCategoria, rotuloCertificado } from "@/lib/equipamentos"
import { urlArquivo } from "@/lib/arquivos"
import { cn, diasAte, formatDate, formatMoeda, textoPrazo } from "@/lib/utils"

interface Ficha extends EquipamentoBase {
  manutencoes: Manutencao[]
  contratos: { id: string; titulo: string; fim: string | null; ativo: boolean; prestador: { nome: string } | null }[]
  certificados: { id: string; tipo: string; titulo: string; validoAte: string | null; arquivo: string | null }[]
  chamados: { id: string; titulo: string; status: string; createdAt: string }[]
  custoTotal: number
}

type Aba = "historico" | "preventivas" | "documentos" | "ocorrencias"

function Info({ icone: Icone, rotulo, valor, alerta }: { icone: React.ComponentType<{ className?: string }>; rotulo: string; valor: React.ReactNode; alerta?: boolean }) {
  if (!valor) return null
  return (
    <div className="flex items-start gap-2">
      <Icone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{rotulo}</p>
        <p className={cn("text-sm", alerta && "text-red-600 font-medium")}>{valor}</p>
      </div>
    </div>
  )
}

function Conteudo() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { usuario } = useAuth()
  const gestor = podeGerenciar(usuario?.role)
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>("historico")
  const [editar, setEditar] = useState(false)
  const [novaOS, setNovaOS] = useState(false)
  const [detalhe, setDetalhe] = useState<Manutencao | null>(null)
  const [editarOS, setEditarOS] = useState<Manutencao | null>(null)
  const [agora] = useState(() => Date.now())

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/equipamentos/${id}`)
    if (!res.ok) { setErro((await res.json().catch(() => ({}))).message ?? "Equipamento não encontrado"); return }
    setFicha(await res.json())
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  const atualizarOS = (m: Manutencao) => {
    setFicha((f) => f && { ...f, manutencoes: f.manutencoes.some((x) => x.id === m.id) ? f.manutencoes.map((x) => (x.id === m.id ? m : x)) : [m, ...f.manutencoes] })
    setDetalhe((d) => (d && d.id === m.id ? m : d))
  }

  const excluir = async () => {
    if (!ficha || !confirm(`Remover "${ficha.nome}"? Se houver histórico, ele será apenas desativado.`)) return
    const res = await fetch(`/api/equipamentos/${id}`, { method: "DELETE" })
    const data = await res.json()
    if (!res.ok) { toast.error(data.message ?? "Erro"); return }
    toast.success(data.desativado ? "Equipamento desativado (histórico preservado)" : "Equipamento excluído")
    router.push("/equipamentos")
  }

  if (erro) return <EstadoVazio icone={Cog} titulo={erro} acao={<Link href="/equipamentos"><Button size="sm" variant="outline">Voltar</Button></Link>} />
  if (!ficha) return <div className="space-y-4"><div className="h-40 rounded-xl bg-muted animate-pulse" /><div className="h-64 rounded-xl bg-muted animate-pulse" /></div>

  const diasGarantia = diasAte(ficha.garantiaAte)
  const concluidas = ficha.manutencoes.filter((m) => m.status === "COMPLETED")
  const ultima = concluidas.sort((a, b) => (b.concluidoEm ?? "").localeCompare(a.concluidoEm ?? ""))[0]
  const idade = ficha.instaladoEm ? Math.floor((agora - new Date(ficha.instaladoEm).getTime()) / (365.25 * 86_400_000)) : null

  return (
    <div className="space-y-6">
      <Link href="/equipamentos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Equipamentos
      </Link>

      {/* Cabeçalho */}
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-col lg:flex-row gap-5">
        <div className="flex gap-4 flex-1 min-w-0">
          {ficha.fotos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlArquivo(ficha.fotos[0])} alt="" className="w-24 h-24 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="w-24 h-24 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Cog className="w-9 h-9 text-primary" /></div>
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground">{rotuloCategoria(ficha.categoria)}{!ficha.ativo && " · desativado"}</p>
            <h1 className="font-heading text-2xl font-semibold leading-tight">{ficha.nome}</h1>
            <div className="flex flex-wrap gap-2 pt-2">
              {podeOperar(usuario?.role) && ficha.ativo && (
                <Button size="sm" onClick={() => setNovaOS(true)}><Plus className="h-4 w-4 mr-1.5" />Registrar manutenção</Button>
              )}
              {gestor && <Button size="sm" variant="outline" onClick={() => setEditar(true)}><Pencil className="h-4 w-4 mr-1.5" />Editar</Button>}
              {gestor && <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={excluir}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 lg:border-l lg:pl-5 border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/equipamentos/${id}/qrcode`} alt="QR Code do equipamento" className="w-24 h-24 rounded-lg border border-border bg-white p-1" />
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground max-w-40">Cole a etiqueta no equipamento: quem escanear abre esta ficha.</p>
            <Link href={`/equipamentos/etiquetas?id=${id}`}>
              <Button size="sm" variant="outline"><Printer className="h-4 w-4 mr-1.5" />Imprimir</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Dados técnicos */}
      <div className="rounded-xl border border-border bg-card p-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Info icone={MapPin} rotulo="Localização" valor={ficha.local} />
        <Info icone={Hash} rotulo="Marca / modelo" valor={[ficha.marca, ficha.modelo].filter(Boolean).join(" ")} />
        <Info icone={Hash} rotulo="Nº de série" valor={ficha.numeroSerie} />
        <Info icone={Calendar} rotulo="Instalado em" valor={ficha.instaladoEm && `${formatDate(ficha.instaladoEm)}${idade !== null ? ` (${idade} ano${idade === 1 ? "" : "s"})` : ""}`} />
        <Info
          icone={ShieldCheck}
          rotulo="Garantia"
          valor={ficha.garantiaAte && `${formatDate(ficha.garantiaAte)} — ${textoPrazo(ficha.garantiaAte)}`}
          alerta={diasGarantia !== null && diasGarantia <= 30}
        />
        <Info
          icone={Calendar}
          rotulo="Vida útil"
          valor={ficha.vidaUtilAnos ? `${ficha.vidaUtilAnos} anos${idade !== null && idade >= ficha.vidaUtilAnos ? " — avaliar substituição" : ""}` : null}
          alerta={!!ficha.vidaUtilAnos && idade !== null && idade >= ficha.vidaUtilAnos}
        />
        <Info icone={CheckCircle2} rotulo="Última manutenção" valor={ultima?.concluidoEm ? formatDate(ultima.concluidoEm) : "Nenhuma registrada"} />
        <Info icone={Wallet} rotulo="Custo acumulado" valor={formatMoeda(ficha.custoTotal)} />
        {ficha.observacoes && <p className="col-span-full text-sm text-muted-foreground whitespace-pre-wrap border-t border-border pt-3">{ficha.observacoes}</p>}
      </div>

      <Pilulas<Aba>
        valor={aba}
        onChange={setAba}
        opcoes={[
          { valor: "historico", rotulo: "Histórico", contagem: ficha.manutencoes.length },
          { valor: "preventivas", rotulo: "Preventivas" },
          { valor: "documentos", rotulo: "Documentos", contagem: ficha.anexos.length + ficha.certificados.length + ficha.contratos.length },
          { valor: "ocorrencias", rotulo: "Ocorrências", contagem: ficha.chamados.length },
        ]}
      />

      {aba === "historico" && (
        ficha.manutencoes.length === 0 ? (
          <EstadoVazio icone={Wrench} titulo="Sem manutenções registradas" descricao="Tudo o que for feito neste equipamento aparece aqui, com fotos e responsáveis." />
        ) : (
          <div className="relative pl-5 space-y-3 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-border">
            {ficha.manutencoes.map((m) => {
              const st = STATUS_CONFIG[m.status] ?? { label: m.status, color: "bg-muted text-muted-foreground border-border" }
              const atrasada = estaAtrasada(m)
              return (
                <button key={m.id} onClick={() => setDetalhe(m)} className="relative block w-full text-left rounded-xl border border-border bg-card p-3 hover:border-primary/40 transition-colors">
                  <span className={cn("absolute -left-[18px] top-4 w-2.5 h-2.5 rounded-full ring-4 ring-background", m.status === "COMPLETED" ? "bg-green-500" : atrasada ? "bg-red-500" : "bg-amber-400")} />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", TIPO_CONFIG[m.tipo].color)}>{TIPO_CONFIG[m.tipo].label}</span>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", st.color)}>{st.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{formatDate(m.concluidoEm ?? m.agendadoEm ?? new Date().toISOString())}</span>
                  </div>
                  <p className="text-sm font-medium mt-1.5">{m.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {m.prestador?.nome ?? m.empresaNome ?? m.prestadorNome ?? "Equipe interna"}
                    {m.valor != null && ` · ${formatMoeda(m.valor)}`}
                    {m.fotos?.length ? ` · ${m.fotos.length} foto(s)` : ""}
                  </p>
                </button>
              )
            })}
          </div>
        )
      )}

      {aba === "preventivas" && <PlanosPreventivos equipamentoId={id} compacto />}

      {aba === "documentos" && (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manuais e anexos</p>
            {ficha.anexos.length ? <GaleriaArquivos arquivos={ficha.anexos} /> : <p className="text-sm text-muted-foreground">Nenhum anexo.</p>}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Certificados e laudos</p>
            {ficha.certificados.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum certificado vinculado. <Link href="/contratos?aba=certificados" className="text-primary hover:underline">Cadastrar</Link></p> : (
              <div className="space-y-2">
                {ficha.certificados.map((c) => {
                  const d = diasAte(c.validoAte)
                  return (
                    <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                      <FileBadge className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{c.titulo}</p>
                        <p className="text-xs text-muted-foreground">{rotuloCertificado(c.tipo)}</p>
                      </div>
                      {c.validoAte && (
                        <span className={cn("text-xs", d !== null && d < 0 ? "text-red-600 font-medium" : d !== null && d <= 30 ? "text-amber-700" : "text-muted-foreground")}>
                          {textoPrazo(c.validoAte)}
                        </span>
                      )}
                      {c.arquivo && <a href={urlArquivo(c.arquivo)} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Abrir</a>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contratos</p>
            {ficha.contratos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum contrato vinculado.</p> : (
              <div className="space-y-2">
                {ficha.contratos.map((c) => (
                  <Link key={c.id} href="/contratos" className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 hover:border-primary/40">
                    <FileSignature className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{c.titulo}</p>
                      <p className="text-xs text-muted-foreground">{c.prestador?.nome ?? "—"}</p>
                    </div>
                    {c.fim && <span className="text-xs text-muted-foreground">{textoPrazo(c.fim)}</span>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {aba === "ocorrencias" && (
        ficha.chamados.length === 0 ? (
          <EstadoVazio icone={AlertCircle} titulo="Nenhuma ocorrência ligada a este equipamento" />
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {ficha.chamados.map((c) => (
              <Link key={c.id} href="/ocorrencias" className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-sm">{c.titulo}</span>
                <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
              </Link>
            ))}
          </div>
        )
      )}

      <EquipamentoForm aberto={editar} editando={ficha} onFechar={() => setEditar(false)} onSalvo={() => carregar()} />
      <ManutencaoForm
        aberto={novaOS || !!editarOS}
        editando={editarOS}
        padrao={{ equipamentoId: id }}
        onFechar={() => { setNovaOS(false); setEditarOS(null) }}
        onSalvo={atualizarOS}
      />
      <ManutencaoDetalhe
        manutencao={detalhe}
        onFechar={() => setDetalhe(null)}
        onAtualizado={atualizarOS}
        onEditar={(m) => { setDetalhe(null); setEditarOS(m) }}
        onExcluido={(mid) => setFicha((f) => f && { ...f, manutencoes: f.manutencoes.filter((x) => x.id !== mid) })}
      />
    </div>
  )
}

export default function EquipamentoPage() {
  return <ModuloGate modulo="equipamentos"><Conteudo /></ModuloGate>
}

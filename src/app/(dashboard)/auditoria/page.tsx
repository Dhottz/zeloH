"use client"

import { useCallback, useEffect, useState } from "react"
import { History, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PageHeader, EstadoVazio } from "@/components/shared/page-header"
import { ModuloGate } from "@/components/shared/modulo-gate"
import { NativeSelect } from "@/components/ui/textarea"
import { cn, formatDateTime } from "@/lib/utils"

interface Registro {
  id: string
  usuarioNome: string | null
  acao: string
  entidade: string
  descricao: string
  createdAt: string
}

const ACAO_COR: Record<string, string> = {
  CRIAR:      "bg-green-100 text-green-700",
  EDITAR:     "bg-blue-100 text-blue-700",
  EXCLUIR:    "bg-red-100 text-red-700",
  APROVAR:    "bg-emerald-100 text-emerald-700",
  REPROVAR:   "bg-orange-100 text-orange-700",
  CONCLUIR:   "bg-violet-100 text-violet-700",
  PUBLICAR:   "bg-sky-100 text-sky-700",
  ASSINATURA: "bg-primary/10 text-primary",
}

const ENTIDADE_LABEL: Record<string, string> = {
  Usuario: "Usuários", Condominio: "Condomínio", Equipamento: "Equipamentos", Manutencao: "Manutenções",
  PlanoManutencao: "Planos preventivos", Contrato: "Contratos", Certificado: "Certificados",
  Prestador: "Prestadores", Despesa: "Despesas", Orcamento: "Orçamento", Comunicado: "Comunicados",
  Enquete: "Enquetes", Documento: "Documentos", Encomenda: "Encomendas", Chamado: "Ocorrências",
  Assinatura: "Assinatura",
}

function Conteudo() {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [entidades, setEntidades] = useState<{ entidade: string; total: number }[]>([])
  const [entidade, setEntidade]   = useState("")
  const [busca, setBusca]         = useState("")
  const [pagina, setPagina]       = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [loading, setLoading]     = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({ pagina: String(pagina), ...(entidade && { entidade }), ...(busca && { busca }) })
    const res = await fetch(`/api/auditoria?${qs}`)
    if (res.ok) {
      const data = await res.json()
      setRegistros(data.registros)
      setEntidades(data.entidades)
      setTotalPaginas(data.totalPaginas)
    }
    setLoading(false)
  }, [pagina, entidade, busca])

  useEffect(() => {
    const t = setTimeout(carregar, 250)
    return () => clearTimeout(t)
  }, [carregar])

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Auditoria"
        descricao="Histórico de quem criou, editou, aprovou ou excluiu informações importantes."
      />

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição ou usuário..."
            className="pl-9"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(1) }}
          />
        </div>
        <NativeSelect
          className="w-52"
          value={entidade}
          onChange={(e) => { setEntidade(e.target.value); setPagina(1) }}
        >
          <option value="">Todas as áreas</option>
          {entidades.map((e) => (
            <option key={e.entidade} value={e.entidade}>
              {ENTIDADE_LABEL[e.entidade] ?? e.entidade} ({e.total})
            </option>
          ))}
        </NativeSelect>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : registros.length === 0 ? (
        <EstadoVazio icone={History} titulo="Nenhum registro encontrado" descricao="As alterações feitas no sistema aparecerão aqui." />
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {registros.map((r) => (
            <div key={r.id} className="flex items-start gap-3 px-4 py-3">
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5", ACAO_COR[r.acao] ?? "bg-muted text-muted-foreground")}>
                {r.acao}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{r.descricao}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {r.usuarioNome ?? "Sistema"} · {ENTIDADE_LABEL[r.entidade] ?? r.entidade}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{formatDateTime(r.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Página {pagina} de {totalPaginas}</span>
          <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

export default function AuditoriaPage() {
  return <ModuloGate modulo="auditoria"><Conteudo /></ModuloGate>
}

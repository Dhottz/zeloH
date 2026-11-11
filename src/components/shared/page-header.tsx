import { cn } from "@/lib/utils"

export function PageHeader({
  titulo,
  descricao,
  acoes,
  className,
}: {
  titulo: string
  descricao?: string
  acoes?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold text-foreground">{titulo}</h1>
        {descricao && <p className="text-sm text-muted-foreground mt-1">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  )
}

export function EstadoVazio({
  icone: Icone,
  titulo,
  descricao,
  acao,
}: {
  icone: React.ComponentType<{ className?: string }>
  titulo: string
  descricao?: string
  acao?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card flex flex-col items-center justify-center py-14 px-6 gap-3 text-center">
      <div className="rounded-full bg-muted p-3">
        <Icone className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{titulo}</p>
        {descricao && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{descricao}</p>}
      </div>
      {acao}
    </div>
  )
}

export function StatCard({
  icone: Icone,
  rotulo,
  valor,
  detalhe,
  tom = "padrao",
}: {
  icone: React.ComponentType<{ className?: string }>
  rotulo: string
  valor: React.ReactNode
  detalhe?: string
  tom?: "padrao" | "alerta" | "perigo" | "ok"
}) {
  const cores = {
    padrao: "bg-primary/10 text-primary",
    alerta: "bg-amber-100 text-amber-700",
    perigo: "bg-red-100 text-red-700",
    ok:     "bg-green-100 text-green-700",
  }[tom]
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
      <div className={cn("rounded-lg p-2 shrink-0", cores)}>
        <Icone className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{rotulo}</p>
        <p className="text-xl font-semibold text-foreground leading-tight mt-0.5">{valor}</p>
        {detalhe && <p className="text-[11px] text-muted-foreground mt-0.5">{detalhe}</p>}
      </div>
    </div>
  )
}

/** Abas simples em formato de "pílula" (padrão visual do app). */
export function Pilulas<T extends string>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: { valor: T; rotulo: string; contagem?: number }[]
  valor: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 flex-wrap rounded-lg border bg-muted/30 p-1 w-fit max-w-full">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
            valor === o.valor ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.rotulo}
          {o.contagem !== undefined && <span className="ml-1.5 text-muted-foreground">{o.contagem}</span>}
        </button>
      ))}
    </div>
  )
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, lerCorpo, dataOuNull } from "@/lib/api"
import { podeGerenciar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { notificarUsuarios, idsMoradores } from "@/lib/notificacao"
import { z } from "zod"

const schema = z.object({
  titulo:           z.string().min(3, "Pergunta obrigatória"),
  descricao:        z.string().nullable().optional(),
  opcoes:           z.array(z.string().trim().min(1)).min(2, "Informe ao menos 2 opções").max(10),
  multiplaEscolha:  z.boolean().default(false),
  encerraEm:        z.string().nullable().optional(),
  resultadoPublico: z.boolean().default(true),
})

function encerrada(e: { encerrada: boolean; encerraEm: Date | null }) {
  return e.encerrada || (!!e.encerraEm && e.encerraEm.getTime() < Date.now())
}

/** GET — enquetes com resultado (morador vê o resultado se for público ou depois de votar). */
export async function GET() {
  const s = await exigirSessao((r) => r !== "PRESTADOR")
  if (!s.ok) return s.res
  const ehMorador = s.data.role === "MORADOR"

  const enquetes = await prisma.enquete.findMany({
    where: { condominioId: s.data.condominioId },
    include: { votos: { select: { usuarioId: true, opcoes: true } } },
    orderBy: [{ encerrada: "asc" }, { createdAt: "desc" }],
  })

  const totalMoradores = ehMorador ? 0 : await prisma.usuario.count({
    where: { condominioId: s.data.condominioId, role: "MORADOR", isActive: true },
  })

  return NextResponse.json({
    totalMoradores,
    enquetes: enquetes.map(({ votos, ...e }) => {
      const meuVoto = votos.find((v) => v.usuarioId === s.data.sub)?.opcoes ?? null
      const fechada = encerrada(e)
      const mostraResultado = !ehMorador || e.resultadoPublico && (!!meuVoto || fechada)
      const contagem = e.opcoes.map((_, i) => votos.filter((v) => v.opcoes.includes(i)).length)
      return {
        ...e,
        encerrada: fechada,
        totalVotos: votos.length,
        meuVoto,
        resultado: mostraResultado ? contagem : null,
      }
    }),
  })
}

export async function POST(req: NextRequest) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const corpo = await lerCorpo(req, schema)
  if (!corpo.ok) return corpo.res
  const d = corpo.data

  const enquete = await prisma.enquete.create({
    data: {
      ...d,
      encerraEm: dataOuNull(d.encerraEm),
      condominioId: s.data.condominioId,
      autorId: s.data.sub,
    },
  })

  await notificarUsuarios({
    condominioId: s.data.condominioId,
    usuarioIds:   await idsMoradores(s.data.condominioId),
    titulo:       `🗳️ Nova enquete: ${enquete.titulo}`,
    descricao:    enquete.encerraEm ? `Vote até ${enquete.encerraEm.toLocaleDateString("pt-BR")}.` : "Dê sua opinião no app.",
    link:         "/morador/enquetes",
  })
  await registrarAuditoria(s.data, "CRIAR", "Enquete", enquete.id, `Criou a enquete "${enquete.titulo}"`)

  return NextResponse.json(enquete, { status: 201 })
}

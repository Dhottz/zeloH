import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"
import { podeGerenciar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { salvarArquivo, storageConfigurado, extensaoPermitida } from "@/lib/storage"
import type { DocumentoTipo } from "@/generated/prisma/enums"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PODE_VER = ["SINDICO", "SUBSINDICO", "ADMIN", "CONSELHO", "ZELADOR"]
const TIPOS_VALIDOS: DocumentoTipo[] = [
  "CONTRATO", "ATA", "REGULAMENTO", "CONVENCAO", "PRESTACAO_CONTAS", "MANUAL", "PROCURACAO", "OUTRO",
]

// GET — lista documentos (versão atual de cada um); ?grupoId= lista o histórico de versões
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (!PODE_VER.includes(session.role)) return NextResponse.json({ message: "Acesso negado" }, { status: 403 })

  const grupoId = req.nextUrl.searchParams.get("grupoId")

  const documentos = await prisma.documento.findMany({
    where: {
      condominioId: session.condominioId,
      tipo: { not: "ENTREGA" },
      ...(grupoId ? { OR: [{ grupoId }, { id: grupoId }] } : { atual: true }),
    },
    orderBy: grupoId ? { versao: "desc" } : { createdAt: "desc" },
    select: {
      id: true,
      nome: true,
      tipo: true,
      tamanho: true,
      uploadadoPor: true,
      createdAt: true,
      arquivo: true,
      mimeType: true,
      grupoId: true,
      versao: true,
      atual: true,
      // conteudo omitido propositalmente na listagem (é grande)
    },
  })

  const ids = [...new Set(documentos.map((d) => d.uploadadoPor).filter(Boolean))] as string[]
  const autores = await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })
  const nomeDe = new Map(autores.map((a) => [a.id, a.nome]))

  return NextResponse.json({
    documentos: documentos.map((d) => ({ ...d, autorNome: d.uploadadoPor ? nomeDe.get(d.uploadadoPor) ?? null : null })),
  })
}

// POST — envia PDF/imagem, extrai o texto (para a Zia) e guarda o original. Com "grupoId", cria nova versão.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (!podeGerenciar(session.role) && session.role !== "ZELADOR") {
    return NextResponse.json({ message: "Acesso negado" }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  const nome = formData.get("nome") as string | null
  const tipo = formData.get("tipo") as string | null
  const grupoIdNovaVersao = (formData.get("grupoId") as string | null) || null

  if (!file) return NextResponse.json({ message: "Arquivo obrigatório" }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ message: "Arquivo muito grande (máx. 10MB)" }, { status: 400 })

  const ehPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  const mime = ehPdf ? "application/pdf" : file.type
  if (!extensaoPermitida(mime)) return NextResponse.json({ message: "Envie PDF ou imagem" }, { status: 400 })

  // Nova versão de um documento existente?
  let anterior: { id: string; grupoId: string | null; versao: number; nome: string; tipo: DocumentoTipo } | null = null
  if (grupoIdNovaVersao) {
    anterior = await prisma.documento.findFirst({
      where: { condominioId: session.condominioId, atual: true, OR: [{ grupoId: grupoIdNovaVersao }, { id: grupoIdNovaVersao }] },
      select: { id: true, grupoId: true, versao: true, nome: true, tipo: true },
    })
    if (!anterior) return NextResponse.json({ message: "Documento original não encontrado" }, { status: 404 })
  }

  const arrayBuffer = await file.arrayBuffer()

  // Extrai texto do PDF (base de conhecimento da Zia)
  let conteudo = ""
  if (ehPdf) {
    try {
      const base64 = Buffer.from(arrayBuffer).toString("base64")
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            {
              type: "text",
              text: "Extraia todo o conteúdo textual deste documento de forma fiel e completa, mantendo a estrutura original (títulos, cláusulas, parágrafos). Não faça resumos nem comentários.",
            },
          ],
        }],
      })
      conteudo = response.content.map((b) => (b.type === "text" ? b.text : "")).join("")
    } catch (err) {
      console.error("[documentos/upload] Erro na extração:", err)
      // Salva mesmo sem conteúdo extraído
    }
  }

  const tipoFinal: DocumentoTipo =
    anterior?.tipo ?? (TIPOS_VALIDOS.includes(tipo as DocumentoTipo) ? (tipo as DocumentoTipo) : "OUTRO")

  // Guarda o arquivo original (para baixar depois) quando o storage está configurado
  let arquivo: string | null = null
  if (storageConfigurado()) {
    try {
      arquivo = await salvarArquivo(session.condominioId, "documentos", arrayBuffer, mime)
    } catch (err) {
      console.error("[documentos/upload] storage:", err)
    }
  }

  const documento = await prisma.$transaction(async (tx) => {
    if (anterior) {
      const grupo = anterior.grupoId ?? anterior.id
      await tx.documento.updateMany({
        where: { condominioId: session.condominioId, OR: [{ grupoId: grupo }, { id: anterior.id }] },
        data: { atual: false },
      })
    }
    const criado = await tx.documento.create({
      data: {
        condominioId: session.condominioId,
        nome: nome || anterior?.nome || file.name.replace(/\.(pdf|jpe?g|png|webp)$/i, ""),
        tipo: tipoFinal,
        tamanho: file.size,
        conteudo: conteudo || null,
        uploadadoPor: session.sub,
        arquivo,
        mimeType: mime,
        grupoId: anterior ? anterior.grupoId ?? anterior.id : null,
        versao: anterior ? anterior.versao + 1 : 1,
        atual: true,
      },
      select: { id: true, nome: true, tipo: true, tamanho: true, createdAt: true, versao: true, grupoId: true },
    })
    // Documento novo: o grupo de versões é ele mesmo
    if (!anterior) {
      await tx.documento.update({ where: { id: criado.id }, data: { grupoId: criado.id } })
      criado.grupoId = criado.id
    }
    return criado
  })

  await registrarAuditoria(
    session, "CRIAR", "Documento", documento.id,
    anterior ? `Enviou a versão ${documento.versao} de "${documento.nome}"` : `Enviou o documento "${documento.nome}"`
  )

  return NextResponse.json({ documento, caracteres: conteudo.length }, { status: 201 })
}

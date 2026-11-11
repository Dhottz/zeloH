import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// GET — lista documentos do condomínio
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  // Só síndico/zelador/admin pode acessar documentos
  if (session.role === "MORADOR") return NextResponse.json({ message: "Acesso negado" }, { status: 403 })

  const documentos = await prisma.documento.findMany({
    where: { condominioId: session.condominioId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nome: true,
      tipo: true,
      tamanho: true,
      uploadadoPor: true,
      createdAt: true,
      // conteudo omitido propositalmente na listagem (é grande)
    },
  })

  return NextResponse.json({ documentos })
}

// POST — faz upload de PDF, extrai texto e salva
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (session.role === "MORADOR") return NextResponse.json({ message: "Acesso negado" }, { status: 403 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  const nome = formData.get("nome") as string | null
  const tipo = formData.get("tipo") as string | null

  if (!file) return NextResponse.json({ message: "Arquivo obrigatório" }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ message: "Arquivo muito grande (máx. 10MB)" }, { status: 400 })

  // Converte para base64
  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")

  // Extrai texto via Anthropic
  let conteudo = ""
  try {
    const response = await (anthropic.messages.create as any)({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          {
            type: "text",
            text: "Extraia todo o conteúdo textual deste documento de forma fiel e completa, mantendo a estrutura original (títulos, cláusulas, parágrafos). Não faça resumos nem comentários.",
          },
        ],
      }],
    })
    conteudo = response.content[0]?.text ?? ""
  } catch (err) {
    console.error("[documentos/upload] Erro na extração:", err)
    // Salva mesmo sem conteúdo extraído
  }

  // Determina tipo válido
  const tiposValidos = ["CONTRATO", "ATA", "REGULAMENTO", "PROCURACAO", "OUTRO"]
  const tipoFinal = tiposValidos.includes(tipo ?? "") ? (tipo as any) : "OUTRO"

  const documento = await prisma.documento.create({
    data: {
      condominioId: session.condominioId,
      nome: nome || file.name.replace(/\.pdf$/i, ""),
      tipo: tipoFinal,
      tamanho: file.size,
      conteudo: conteudo || null,
      uploadadoPor: session.sub,
    },
    select: { id: true, nome: true, tipo: true, tamanho: true, createdAt: true },
  })

  return NextResponse.json({ documento, caracteres: conteudo.length }, { status: 201 })
}

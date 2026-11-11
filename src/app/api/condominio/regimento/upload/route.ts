import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { podeGerenciar } from "@/lib/permissions"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (!podeGerenciar(session.role)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ message: "Arquivo não enviado" }, { status: 400 })
    }

    if (!file.type.includes("pdf")) {
      return NextResponse.json({ message: "Apenas arquivos PDF são aceitos" }, { status: 400 })
    }

    // Limite de 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ message: "Arquivo muito grande (máx. 10MB)" }, { status: 400 })
    }

    // Converte para base64
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString("base64")

    // Usa Claude para extrair o texto do PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (anthropic.messages.create as any)({
      model: "claude-haiku-4-5",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: "Extraia todo o conteúdo textual deste PDF de regimento de condomínio. Retorne APENAS o texto extraído, preservando a estrutura de capítulos, artigos e parágrafos. Sem comentários adicionais.",
            },
          ],
        },
      ],
    })

    const bloco = response.content[0]
    if (bloco.type !== "text" || !bloco.text.trim()) {
      return NextResponse.json({ message: "Não foi possível extrair texto do PDF." }, { status: 400 })
    }

    const texto = bloco.text.trim()

    await prisma.condominio.update({
      where: { id: session.condominioId },
      data: { regimento: texto },
    })

    return NextResponse.json({
      ok: true,
      caracteres: texto.length,
    })
  } catch (error) {
    console.error("[POST /api/condominio/regimento/upload]", error)
    return NextResponse.json({ message: "Erro ao processar PDF" }, { status: 500 })
  }
}

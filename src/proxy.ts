import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { getJwtSecret } from "@/lib/jwt-secret"

const PUBLIC_ROUTES = [
  "/login",
  "/cadastro",
  "/primeiro-acesso",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/primeiro-acesso",
  "/api/webhooks/",
  "/api/cron",
  "/sw.js",
  "/manifest.json",
  "/offline.html",
  "/icons/",
]

// Rotas exclusivas de moradores
const MORADOR_ROUTES = ["/morador"]

const GESTORES = ["SINDICO", "SUBSINDICO", "ADMIN"]
const EQUIPE   = [...GESTORES, "CONSELHO", "ZELADOR", "PORTEIRO"]

/**
 * Rotas do painel e quem pode acessá-las.
 * A checagem fina de permissão acontece nas APIs; aqui é só o redirecionamento.
 */
const PAINEL_ROUTES: Record<string, string[]> = {
  "/dashboard":     EQUIPE,
  "/ocorrencias":   EQUIPE,
  "/comunicados":   EQUIPE,
  "/enquetes":      EQUIPE,
  "/moradores":     EQUIPE,
  "/reservas":      EQUIPE,
  "/entregas":      EQUIPE,
  "/prestadores":   EQUIPE,
  "/chat":          EQUIPE,
  "/manutencoes":   [...GESTORES, "CONSELHO", "ZELADOR", "PRESTADOR"],
  "/equipamentos":  [...GESTORES, "CONSELHO", "ZELADOR", "PRESTADOR"],
  "/contratos":     [...GESTORES, "CONSELHO"],
  "/documentos":    [...GESTORES, "CONSELHO", "ZELADOR"],
  "/financeiro":    [...GESTORES, "CONSELHO"],
  "/auditoria":     ["SINDICO", "ADMIN", "CONSELHO"],
  "/zia":           GESTORES,
  "/configuracoes": GESTORES,
  "/assinatura":    ["SINDICO", "ADMIN"],
  "/condominios":   ["SINDICO", "ADMIN"],
}

interface JwtPayload {
  sub: string
  role: string
  condominioId: string
}

function casa(pathname: string, rota: string) {
  return pathname === rota || pathname.startsWith(rota + "/")
}

function homeDo(role: string) {
  if (role === "MORADOR") return "/morador"
  if (role === "PRESTADOR") return "/manutencoes"
  return "/dashboard"
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  const token = req.cookies.get("zeloh_token")?.value

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", req.url))
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    const { role } = payload as unknown as JwtPayload

    if (pathname.startsWith("/api/")) return NextResponse.next()

    if (pathname === "/") {
      return NextResponse.redirect(new URL(homeDo(role), req.url))
    }

    const isMoradorRoute = MORADOR_ROUTES.some((r) => casa(pathname, r))
    if (role === "MORADOR") {
      const isPainel = Object.keys(PAINEL_ROUTES).some((r) => casa(pathname, r))
      if (isPainel) return NextResponse.redirect(new URL("/morador", req.url))
      return NextResponse.next()
    }

    if (isMoradorRoute) {
      return NextResponse.redirect(new URL(homeDo(role), req.url))
    }

    const rota = Object.keys(PAINEL_ROUTES).find((r) => casa(pathname, r))
    if (rota && !PAINEL_ROUTES[rota].includes(role)) {
      return NextResponse.redirect(new URL(homeDo(role), req.url))
    }

    return NextResponse.next()
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Sessão expirada" }, { status: 401 })
    }
    const response = NextResponse.redirect(new URL("/login", req.url))
    response.cookies.delete("zeloh_token")
    return response
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.png|.*\\.svg|.*\\.jpg).*)",
  ],
}

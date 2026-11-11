import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "zeloh-dev-secret-min-32-chars-ok!"
)

const PUBLIC_ROUTES = [
  "/login",
  "/cadastro",
  "/primeiro-acesso",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/primeiro-acesso",
  "/api/webhooks/vistto",
  "/api/cron",
]

// Rotas exclusivas de moradores
const MORADOR_ROUTES = ["/morador"]

// Rotas do painel (síndico/admin/zelador)
const PAINEL_ROUTES = [
  "/dashboard", "/moradores", "/comunicados", "/reservas",
  "/ocorrencias", "/manutencoes", "/entregas", "/configuracoes", "/chat",
  "/prestadores", "/zia",
]

// Rotas bloqueadas para zelador e porteiro
const SINDICO_ONLY_ROUTES = ["/configuracoes", "/zia"]

// Rotas extras bloqueadas para porteiro (que zelador pode acessar)
const PORTEIRO_FORBIDDEN_ROUTES = ["/manutencoes"]

interface JwtPayload {
  sub: string
  role: string
  condominioId: string
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rotas públicas passam direto
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  const token = req.cookies.get("zeloh_token")?.value

  // Sem token → redireciona para login (exceto API)
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", req.url))
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const { role } = payload as unknown as JwtPayload

    // ── Controle de acesso por role ──────────────────────────────────────────

    const isMoradorRoute = MORADOR_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))
    const isPainelRoute  = PAINEL_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))

    if (role === "MORADOR") {
      // Morador tentando acessar o painel → redireciona para o app
      if (isPainelRoute) {
        return NextResponse.redirect(new URL("/morador", req.url))
      }
    } else {
      // Síndico/Admin/Zelador tentando acessar o app do morador → redireciona para o painel
      if (isMoradorRoute) {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }

      // Zelador e porteiro não acessam rotas exclusivas do síndico/admin
      if (role === "ZELADOR" || role === "PORTEIRO") {
        const isSindicoOnly = SINDICO_ONLY_ROUTES.some(
          (r) => pathname === r || pathname.startsWith(r + "/")
        )
        if (isSindicoOnly) {
          return NextResponse.redirect(new URL("/dashboard", req.url))
        }
      }

      // Porteiro não acessa manutenções
      if (role === "PORTEIRO") {
        const isPorteiroForbidden = PORTEIRO_FORBIDDEN_ROUTES.some(
          (r) => pathname === r || pathname.startsWith(r + "/")
        )
        if (isPorteiroForbidden) {
          return NextResponse.redirect(new URL("/dashboard", req.url))
        }
      }
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.jpg).*)",
  ],
}

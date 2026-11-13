import type { Metadata, Viewport } from "next"
import { Inter, Playfair_Display, Geist_Mono } from "next/font/google"
import { AuthProvider } from "@/components/layout/auth-provider"
import { Toaster } from "@/components/ui/sonner"
import { PwaProvider } from "@/components/pwa/pwa"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "ZeloH — Gestão Condominial",
    template: "%s | ZeloH",
  },
  description: "Centralize a operação do condomínio com assistente ZileIA integrada.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ZeloH",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    title: "ZeloH — Gestão Condominial",
    description: "Plataforma SaaS de gestão de condomínios com IA.",
    siteName: "ZeloH",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#B84A2E" },
    { media: "(prefers-color-scheme: dark)",  color: "#1C1410" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${playfair.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PwaProvider><AuthProvider>{children}</AuthProvider></PwaProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}

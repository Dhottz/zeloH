"use client"

import { useState, useCallback } from "react"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { cn } from "@/lib/utils"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const openSidebar  = useCallback(() => setSidebarOpen(true),  [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* ── Overlay mobile ─────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
          aria-hidden
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          // Mobile: posição fixa, slide from left
          "fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out",
          // Desktop: posição relativa, sempre visível
          "lg:relative lg:translate-x-0 lg:z-auto lg:transition-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar onClose={closeSidebar} />
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onMenuClick={openSidebar} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

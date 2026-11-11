import { DashboardShell } from "@/components/layout/dashboard-shell"

// O middleware já bloqueia moradores antes de chegar aqui
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardShell>{children}</DashboardShell>
}

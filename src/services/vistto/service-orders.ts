import visttoClient from "./client"

export interface VisttoServiceOrder {
  id: string
  friendlyCode: string
  title: string
  description?: string
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELED"
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  technicianName?: string
  observations?: string
  value?: number
  scheduledAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  client: { id: string; name: string; document?: string }
  location: { id: string; name: string }
  company: { id: string; name: string; document?: string }
}

/**
 * Busca todas as OSs de um cliente pelo ID do cliente no VISTTO
 */
export async function getServiceOrdersByClient(
  visttoClientId: string
): Promise<VisttoServiceOrder[]> {
  const { data } = await visttoClient.get("/service-orders", {
    params: { clientId: visttoClientId },
  })
  return data
}

/**
 * Busca todas as OSs de um condomínio pelo CNPJ (document do Client no VISTTO)
 */
export async function getServiceOrdersByCNPJ(
  cnpj: string
): Promise<VisttoServiceOrder[]> {
  const { data } = await visttoClient.get("/service-orders", {
    params: { document: cnpj },
  })
  return data
}

/**
 * Busca o client no VISTTO pelo CNPJ para vincular ao condomínio no ZeloH
 */
export async function findClientByCNPJ(cnpj: string) {
  const { data } = await visttoClient.get("/clients", {
    params: { document: cnpj },
  })
  return data?.[0] ?? null
}

/**
 * Busca uma OS específica pelo ID
 */
export async function getServiceOrderById(id: string): Promise<VisttoServiceOrder> {
  const { data } = await visttoClient.get(`/service-orders/${id}`)
  return data
}

import axios from "axios"

const visttoClient = axios.create({
  baseURL: process.env.VISTTO_API_URL,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.VISTTO_API_KEY,
  },
  timeout: 10000,
})

visttoClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("[VISTTO] Erro na requisição:", error.response?.data ?? error.message)
    return Promise.reject(error)
  }
)

export default visttoClient

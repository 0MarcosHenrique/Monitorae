import axios, { AxiosRequestConfig } from 'axios'
import { performance } from 'perf_hooks'

export interface CheckerResult {
  statusCode: number | null
  latency: number
  responseBody: string | null
  errorMessage: string | null
  isUp: boolean
}

export interface CheckerOptions {
  url: string
  method: string
  headers?: any
  body?: any
  timeout: number
  expectedStatus: number[]
  expectedBodyContains?: string
}

export const runHealthCheck = async (options: CheckerOptions): Promise<CheckerResult> => {
  const start = performance.now()
  let statusCode: number | null = null
  let responseBody: string | null = null
  let errorMessage: string | null = null
  let isUp = false

  try {
    const config: AxiosRequestConfig = {
      url: options.url,
      method: options.method,
      headers: options.headers || {},
      data: options.body,
      timeout: options.timeout,
      // Faz com que o axios não lance erro mesmo para status >= 400
      validateStatus: () => true,
    }

    const response = await axios(config)
    const end = performance.now()
    const latency = end - start

    statusCode = response.status
    
    // Tratamos o responseBody para guardar apenas até 1000 caracteres, conforme a especificação do Schema
    if (response.data) {
      responseBody = typeof response.data === 'string' 
        ? response.data.substring(0, 1000) 
        : JSON.stringify(response.data).substring(0, 1000)
    }

    // Verifica se a requisição está UP através da array de status esperados
    isUp = options.expectedStatus.includes(statusCode)

    // Se estivar UP e possuir uma string esperada, verificamos
    if (isUp && options.expectedBodyContains) {
      if (!responseBody || !responseBody.includes(options.expectedBodyContains)) {
        isUp = false
        errorMessage = `Body da resposta não contém: "${options.expectedBodyContains}"`
      }
    }

    return {
      statusCode,
      latency,
      responseBody,
      errorMessage,
      isUp
    }

  } catch (error) {
    const end = performance.now()
    const latency = end - start
    isUp = false

    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        errorMessage = `Timeout após ${options.timeout}ms`
      } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
        errorMessage = 'DNS não resolveu'
      } else if (error.message === 'Network Error') {
        errorMessage = 'Erro de conexão'
      } else {
        errorMessage = error.message || 'Erro HTTP desconhecido'
      }
    } else {
      errorMessage = error instanceof Error ? error.message : 'Erro interno ao realizar check'
    }

    return {
      statusCode: null,
      latency,
      responseBody: null,
      errorMessage,
      isUp
    }
  }
}

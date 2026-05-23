import { fetchAuthSession } from 'aws-amplify/auth'
import { z } from 'zod'

const API_ENDPOINT = (import.meta.env.VITE_API_ENDPOINT as string) ?? ''

async function getIdToken(): Promise<string> {
  const session = await fetchAuthSession()
  const token = session.tokens?.idToken?.toString()
  if (!token) throw new Error('認証セッションが見つかりません')
  return token
}

async function request<T>(path: string, method: string, options?: { body?: unknown, schema?: z.ZodSchema<T> }): Promise<T> {
  const token = await getIdToken()
  const res = await fetch(`${API_ENDPOINT}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'APIエラー' }))
    const error = new Error((err as { message?: string }).message ?? 'APIエラー') as Error & { status: number }
    error.status = res.status
    throw error
  }
  const data = await res.json()
  if (options?.schema) {
    return options.schema.parse(data)
  }
  return data as T
}

export const apiGet = <T>(path: string, schema?: z.ZodSchema<T>) => request<T>(path, 'GET', { schema })
export const apiPost = <T>(path: string, body?: unknown, schema?: z.ZodSchema<T>) => request<T>(path, 'POST', { body, schema })
export const apiPut = <T>(path: string, body?: unknown, schema?: z.ZodSchema<T>) => request<T>(path, 'PUT', { body, schema })
export const apiDelete = <T>(path: string, body?: unknown, schema?: z.ZodSchema<T>) => request<T>(path, 'DELETE', { body, schema })

import { fetchAuthSession } from 'aws-amplify/auth'

const API_ENDPOINT = (import.meta.env.VITE_API_ENDPOINT as string) ?? ''

async function getIdToken(): Promise<string> {
  const session = await fetchAuthSession()
  const token = session.tokens?.idToken?.toString()
  if (!token) throw new Error('認証セッションが見つかりません')
  return token
}

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = await getIdToken()
  const res = await fetch(`${API_ENDPOINT}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'APIエラー' }))
    const error = new Error((err as { message?: string }).message ?? 'APIエラー') as Error & { status: number }
    error.status = res.status
    throw error
  }
  return res.json() as Promise<T>
}

export const apiGet = <T>(path: string) => request<T>(path, 'GET')
export const apiPost = <T>(path: string, body?: unknown) => request<T>(path, 'POST', body)
export const apiPut = <T>(path: string, body?: unknown) => request<T>(path, 'PUT', body)
export const apiDelete = <T>(path: string, body?: unknown) => request<T>(path, 'DELETE', body)

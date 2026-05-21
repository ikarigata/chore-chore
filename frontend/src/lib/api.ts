import { fetchAuthSession } from 'aws-amplify/auth'

const API_ENDPOINT = (import.meta.env.VITE_API_ENDPOINT as string) ?? ''

async function getIdToken(): Promise<string> {
  const session = await fetchAuthSession()
  const token = session.tokens?.idToken?.toString()
  if (!token) throw new Error('認証セッションが見つかりません')
  return token
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const token = await getIdToken()
  const res = await fetch(`${API_ENDPOINT}${path}`, {
    method: 'POST',
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

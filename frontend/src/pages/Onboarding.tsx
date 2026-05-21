import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAuthSession } from 'aws-amplify/auth'
import { Loader2, Sparkles, Users } from 'lucide-react'
import { flatBorder } from '../styles'
import { apiPost } from '../lib/api'
import { INVITE_TOKEN_KEY } from './Auth'

export default function Onboarding() {
  const navigate = useNavigate()
  const inviteToken = localStorage.getItem(INVITE_TOKEN_KEY)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) return
    setError('')
    setLoading(true)
    try {
      if (inviteToken) {
        await apiPost('/families/join', { token: inviteToken, displayName: displayName.trim() })
        localStorage.removeItem(INVITE_TOKEN_KEY)
      } else {
        await apiPost('/families', { displayName: displayName.trim() })
      }
      // JWT を強制リフレッシュして custom:family_id を取り込む
      await fetchAuthSession({ forceRefresh: true })
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message ?? '失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-teal-50 flex flex-col items-center justify-center p-6">
      <div className={`bg-white w-full max-w-sm rounded-3xl p-8 ${flatBorder} shadow-[8px_8px_0px_#292524] text-center`}>
        <div className="w-20 h-20 bg-yellow-200 rounded-full border-4 border-stone-800 mx-auto mb-6 flex items-center justify-center">
          {inviteToken
            ? <Users className="w-10 h-10 text-stone-800" />
            : <Sparkles className="w-10 h-10 text-stone-800" />}
        </div>

        <h1 className="text-2xl font-black mb-2">
          {inviteToken ? '家族に参加する' : '家族をつくる'}
        </h1>
        <p className="font-bold text-stone-500 mb-8 leading-relaxed">
          {inviteToken
            ? '招待された家族グループに参加します。'
            : 'まず、あなたの名前を教えてください。'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="ニックネーム（例: パパ、ママ）"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className={`w-full p-3 rounded-xl bg-stone-50 ${flatBorder} font-bold text-center focus:outline-none focus:ring-2 focus:ring-teal-400`}
          />
          {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
          <button
            type="submit"
            disabled={loading || !displayName.trim()}
            className={`w-full bg-teal-400 py-4 rounded-xl font-black text-lg ${flatBorder} shadow-[0px_4px_0px_#292524] active:shadow-none active:translate-y-1 transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
          >
            {loading
              ? <Loader2 className="w-6 h-6 animate-spin" />
              : inviteToken ? '参加する' : 'はじめる'}
          </button>
        </form>
      </div>
    </div>
  )
}

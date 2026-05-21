import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchAuthSession } from 'aws-amplify/auth'
import { Sparkles, X, Loader2 } from 'lucide-react'
import { flatBorder, bounceClass } from '../styles'
import { INVITE_TOKEN_KEY } from './Auth'

export default function Invite() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      localStorage.setItem(INVITE_TOKEN_KEY, token)
    }
    // サインイン済みならそのままオンボーディングへ（family_id 有無はオンボーディング/AuthGuard が判定）
    fetchAuthSession()
      .then(session => {
        if (session.tokens) {
          navigate('/onboarding', { replace: true })
        } else {
          setChecking(false)
        }
      })
      .catch(() => setChecking(false))
  }, [navigate, searchParams])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-teal-50 flex flex-col items-center justify-center p-6 text-stone-800">
      <div className={`bg-white w-full max-w-sm rounded-3xl p-8 ${flatBorder} shadow-[8px_8px_0px_#292524] text-center relative`}>
        <button
          onClick={() => navigate(-1)}
          className={`absolute top-4 left-4 p-2 bg-stone-100 rounded-full ${flatBorder} ${bounceClass}`}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-20 h-20 bg-yellow-200 rounded-full border-4 border-stone-800 mx-auto mb-6 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-stone-800" />
        </div>

        <h1 className="text-2xl font-black mb-2">ieziへようこそ！</h1>
        <p className="font-bold text-stone-600 mb-8 leading-relaxed">
          家族から招待が届いています。<br />一緒に家事管理を始めましょう！
        </p>

        <button
          onClick={() => navigate('/auth')}
          className={`w-full bg-teal-400 py-4 rounded-xl font-black text-lg border-2 border-stone-800 shadow-[0px_4px_0px_#292524] active:shadow-none active:translate-y-1 transition-all`}
        >
          アカウントを作って参加する
        </button>

        <button
          onClick={() => navigate('/auth')}
          className="mt-4 block text-xs font-bold text-stone-400 underline decoration-stone-300 underline-offset-4 mx-auto"
        >
          すでにアカウントをお持ちの方はこちら
        </button>
      </div>
    </div>
  )
}

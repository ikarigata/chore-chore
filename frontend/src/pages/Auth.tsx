import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { confirmSignUp, resendSignUpCode, signIn, signUp } from 'aws-amplify/auth'
import { Loader2, Sparkles } from 'lucide-react'
import { flatBorder, bounceClass } from '../styles'

export const INVITE_TOKEN_KEY = 'iezi_invite_token'

type Tab = 'signin' | 'signup'
type SignupStep = 'form' | 'verify'

export default function Auth() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [signupStep, setSignupStep] = useState<SignupStep>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function afterAuth() {
    navigate('/')
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn({ username: email, password })
      afterAuth()
    } catch (err) {
      setError((err as Error).message ?? 'サインインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signUp({ username: email, password })
      setSignupStep('verify')
    } catch (err) {
      setError((err as Error).message ?? '登録に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await confirmSignUp({ username: email, confirmationCode: code })
      await signIn({ username: email, password })
      afterAuth()
    } catch (err) {
      setError((err as Error).message ?? '確認に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError('')
    try {
      await resendSignUpCode({ username: email })
    } catch (err) {
      setError((err as Error).message ?? '再送信に失敗しました')
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center p-6">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-black flex items-center gap-2 justify-center">
          <Sparkles className="w-7 h-7 text-brand-yellow" />
          iezi
        </h1>
        <p className="text-sm font-bold text-stone-500 mt-1">家族の家事ポイント管理アプリ</p>
      </div>

      <div className={`bg-white w-full max-w-sm rounded-3xl p-6 ${flatBorder} shadow-[6px_6px_0px_#292524]`}>
        {signupStep === 'verify' ? (
          <>
            <h2 className="text-xl font-black mb-2 text-center">メール確認</h2>
            <p className="text-sm font-bold text-stone-500 text-center mb-6">
              {email} に送られた確認コードを入力してください
            </p>
            <form onSubmit={handleVerify} className="space-y-4">
              <input
                type="text"
                placeholder="確認コード"
                value={code}
                onChange={e => setCode(e.target.value)}
                className={`w-full p-3 rounded-xl bg-stone-50 ${flatBorder} font-bold text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-teal`}
                inputMode="numeric"
              />
              {error && <p className="text-red-500 text-sm font-bold text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-brand-teal text-white py-3 rounded-xl font-black text-lg ${flatBorder} flex items-center justify-center gap-2 ${bounceClass}`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '確認する'}
              </button>
              <button
                type="button"
                onClick={handleResend}
                className="w-full text-sm font-bold text-stone-500 underline underline-offset-4"
              >
                コードを再送信する
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="flex mb-6 bg-stone-100 rounded-2xl p-1">
              {(['signin', 'signup'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError('') }}
                  className={`flex-1 py-2 rounded-xl font-black text-sm transition-all ${tab === t ? `bg-white ${flatBorder} shadow-[2px_2px_0px_#292524]` : 'text-stone-400'}`}
                >
                  {t === 'signin' ? 'ログイン' : '新規登録'}
                </button>
              ))}
            </div>

            <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
              <input
                type="email"
                placeholder="メールアドレス"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={`w-full p-3 rounded-xl bg-stone-50 ${flatBorder} font-bold focus:outline-none focus:ring-2 focus:ring-brand-teal`}
              />
              <input
                type="password"
                placeholder="パスワード（8文字以上、数字を含む）"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={`w-full p-3 rounded-xl bg-stone-50 ${flatBorder} font-bold focus:outline-none focus:ring-2 focus:ring-brand-teal`}
              />
              {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-brand-teal text-white py-3 rounded-xl font-black text-lg ${flatBorder} flex items-center justify-center gap-2 ${bounceClass}`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : tab === 'signin' ? 'ログイン' : '登録する'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

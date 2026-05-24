import { useEffect, useState } from 'react'
import { X, Loader2, Copy, Check } from 'lucide-react'
import QRCode from 'react-qr-code'
import { flatBorder, bounceClass } from '../styles'
import { apiPost } from '../lib/api'

interface InviteResponse {
  token: string
  url: string
  expiresAt: number
}

interface QrModalProps {
  onClose: () => void
}

export default function QrModal({ onClose }: QrModalProps) {
  const [invite, setInvite] = useState<InviteResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    apiPost<InviteResponse>('/families/invites')
      .then(setInvite)
      .catch(err => setError((err as Error).message ?? '招待リンクの生成に失敗しました'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCopy() {
    if (!invite?.url) return
    await navigator.clipboard.writeText(invite.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className={`bg-white w-full max-w-sm rounded-3xl p-6 ${flatBorder} shadow-[8px_8px_0px_#292524] relative animate-in zoom-in-95 duration-200`}>
        <button onClick={onClose} className={`absolute top-4 right-4 p-2 bg-stone-100 rounded-full ${flatBorder} ${bounceClass}`}>
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-black mb-6 text-center">家族を招待</h3>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-brand-teal" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500 font-bold">{error}</div>
        ) : (
          <>
            <div className={`w-48 h-48 mx-auto bg-white rounded-2xl ${flatBorder} flex items-center justify-center mb-6 p-3`}>
              <QRCode
                value={invite?.url ?? ''}
                size={168}
                bgColor="#ffffff"
                fgColor="#292524"
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                readOnly
                value={invite?.url ?? ''}
                className={`flex-1 p-3 rounded-xl bg-stone-50 ${flatBorder} font-bold text-sm text-stone-500 min-w-0`}
              />
              <button
                onClick={handleCopy}
                className={`bg-stone-800 text-white px-4 rounded-xl font-bold border-2 border-stone-800 ${bounceClass} flex items-center gap-1 shrink-0`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-xs font-bold text-stone-400 text-center">有効期限: 24時間</p>
          </>
        )}
      </div>
    </div>
  )
}

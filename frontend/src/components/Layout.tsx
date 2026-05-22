import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, ScrollText, Settings, Sparkles } from 'lucide-react'
import NavButton from './NavButton'
import QrModal from './QrModal'
import { useApp } from '../context'
import { flatBorder } from '../styles'

export interface LayoutOutletContext {
  onOpenQr: () => void
}

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [showQrModal, setShowQrModal] = useState(false)
  const { members, mySub, initialized } = useApp()

  const path = location.pathname
  const activeTab = path === '/history' ? 'history' : path === '/settings' ? 'settings' : 'home'
  const myName = members.find(m => m.cognitoSub === mySub)?.displayName ?? ''

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-amber-50 text-stone-800 font-sans pb-24">
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b-2 border-stone-800 sticky top-0 z-10">
        <h1 className="text-xl font-black tracking-wider flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          iezi
        </h1>
        {myName && (
          <div className={`bg-yellow-200 px-3 py-1 rounded-full font-bold text-sm ${flatBorder}`}>
            {myName}
          </div>
        )}
      </header>

      <main className="max-w-md mx-auto w-full">
        <Outlet context={{ onOpenQr: () => setShowQrModal(true) } satisfies LayoutOutletContext} />
      </main>

      <nav className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 bg-white border-t-2 border-stone-800 flex justify-around p-3 z-20">
        <NavButton icon={Home} label="ホーム" active={activeTab === 'home'} onClick={() => navigate('/')} />
        <NavButton icon={ScrollText} label="履歴" active={activeTab === 'history'} onClick={() => navigate('/history')} />
        <NavButton icon={Settings} label="設定" active={activeTab === 'settings'} onClick={() => navigate('/settings')} />
      </nav>

      {showQrModal && <QrModal onClose={() => setShowQrModal(false)} />}
    </div>
  )
}

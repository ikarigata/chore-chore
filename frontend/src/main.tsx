import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { fetchAuthSession } from 'aws-amplify/auth'
import './lib/amplify'
import { AppProvider } from './context'
import Layout from './components/Layout'
import Home from './pages/Home'
import History from './pages/History'
import Memo from './pages/Memo'
import Negurai from './pages/Negurai'
import Settings from './pages/Settings'
import Invite from './pages/Invite'
import Auth from './pages/Auth'
import Onboarding from './pages/Onboarding'
import './index.css'

type AuthState = 'loading' | 'unauthed' | 'orphan' | 'authed'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>('loading')

  useEffect(() => {
    fetchAuthSession()
      .then(session => {
        if (!session.tokens) { setState('unauthed'); return }
        const familyId = session.tokens.idToken?.payload?.['custom:family_id']
        setState(familyId ? 'authed' : 'orphan')
      })
      .catch(() => setState('unauthed'))
  }, [])

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <div className="w-8 h-8 border-4 border-brand-teal border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (state === 'unauthed') return <Navigate to="/auth" replace />
  if (state === 'orphan') return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

const router = createBrowserRouter([
  { path: '/auth', element: <Auth /> },
  { path: '/invite', element: <Invite /> },
  { path: '/onboarding', element: <Onboarding /> },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppProvider>
          <Layout />
        </AppProvider>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'memo', element: <Memo /> },
      { path: 'history', element: <History /> },
      { path: 'negurai', element: <Negurai /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)

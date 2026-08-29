import { Navigate, Outlet } from 'react-router-dom'

import { FullPageLoader } from '@/components/ui'
import { useAuth } from './AuthContext'

// Wraps the public auth routes: a signed-in user visiting /signin or /signup is
// sent to the app instead.
export function RedirectIfAuthed() {
  const { status } = useAuth()

  if (status === 'loading') return <FullPageLoader />
  if (status === 'authed') return <Navigate to="/" replace />
  return <Outlet />
}

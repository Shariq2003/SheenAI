import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { FullPageLoader } from '@/components/ui'
import { useAuth } from './AuthContext'

export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader label="Signing you in" />
  if (status === 'anon') {
    return <Navigate to="/signin" replace state={{ from: location }} />
  }
  return <Outlet />
}

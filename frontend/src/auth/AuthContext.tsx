import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import { api, getAuthToken, setAuthToken } from '@/lib/api'
import type { User } from '@/lib/types'

type AuthStatus = 'loading' | 'authed' | 'anon'

interface AuthValue {
  user: User | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  // Validate an existing token on first load.
  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!getAuthToken()) {
        setStatus('anon')
        return
      }
      try {
        const me = await api.me()
        if (!cancelled) {
          setUser(me)
          setStatus('authed')
        }
      } catch {
        if (!cancelled) {
          setAuthToken(null)
          setUser(null)
          setStatus('anon')
        }
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  // The api layer emits this on any 401.
  useEffect(() => {
    function onUnauthorized() {
      setAuthToken(null)
      setUser(null)
      setStatus('anon')
    }
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password)
    setAuthToken(res.access_token)
    setUser(res.user)
    setStatus('authed')
  }, [])

  const signup = useCallback(async (email: string, password: string) => {
    const res = await api.signup(email, password)
    setAuthToken(res.access_token)
    setUser(res.user)
    setStatus('authed')
  }, [])

  const logout = useCallback(() => {
    setAuthToken(null)
    setUser(null)
    setStatus('anon')
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ user, status, login, signup, logout }),
    [user, status, login, signup, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

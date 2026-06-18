/**
 * Auth state for the platform-user session.
 *
 * The driver app authenticates separately (see useDriverAuth); this context
 * covers the four platform roles. It bootstraps from a stored token via
 * GET /auth/me so a page reload keeps the user signed in.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '@/api/client'
import { tokenStore } from '@/auth/tokenStore'
import type { User } from '@/types/models'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function bootstrap() {
      if (!tokenStore.getUserAccess()) {
        setLoading(false)
        return
      }
      try {
        const res = await api.get<User>('/auth/me')
        if (active) setUser(res.data)
      } catch {
        tokenStore.clearUser()
      } finally {
        if (active) setLoading(false)
      }
    }
    void bootstrap()
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password })
    tokenStore.setUser(res.data.access_token, res.data.refresh_token)
    setUser(res.data.user as User)
  }, [])

  const logout = useCallback(() => {
    tokenStore.clearUser()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

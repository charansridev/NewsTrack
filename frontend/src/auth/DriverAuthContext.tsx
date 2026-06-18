/**
 * Driver session — the SECOND, independent JWT system.
 *
 * Kept entirely separate from the platform-user AuthContext: a driver token is
 * never sent to user endpoints and vice versa. All driver-app API calls pass
 * `{ audience: 'driver' }` so the client attaches the driver token.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '@/api/client'
import { tokenStore } from '@/auth/tokenStore'
import type { Driver } from '@/types/models'

interface DriverAuthState {
  driver: Driver | null
  isAuthenticated: boolean
  login: (mobile: string, password: string) => Promise<void>
  logout: () => void
}

const DriverAuthContext = createContext<DriverAuthState | null>(null)

export function DriverAuthProvider({ children }: { children: ReactNode }) {
  const [driver, setDriver] = useState<Driver | null>(null)

  const login = useCallback(async (mobile: string, password: string) => {
    const res = await api.post(
      '/driver/auth/login',
      { mobile, password },
      { audience: 'driver' },
    )
    tokenStore.setDriver(res.data.access_token)
    setDriver(res.data.driver as Driver)
  }, [])

  const logout = useCallback(() => {
    tokenStore.clearDriver()
    setDriver(null)
  }, [])

  const value = useMemo(
    () => ({ driver, isAuthenticated: Boolean(tokenStore.getDriverAccess()), login, logout }),
    [driver],
  )

  return <DriverAuthContext.Provider value={value}>{children}</DriverAuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDriverAuth() {
  const ctx = useContext(DriverAuthContext)
  if (!ctx) throw new Error('useDriverAuth must be used within DriverAuthProvider')
  return ctx
}

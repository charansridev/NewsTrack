/** Route guards: authentication + role-based access. */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import type { UserRole } from '@/types/models'

function FullScreenLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center text-muted-foreground">
      Loading…
    </div>
  )
}

/** Requires a signed-in platform user. */
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/** Requires the signed-in user to hold one of the given roles. */
export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  if (!user.role || !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

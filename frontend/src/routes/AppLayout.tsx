/** Authenticated ops-console shell: role-aware sidebar nav + header. */
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Truck,
  Package,
  AlertTriangle,
  Users,
  Building2,
  CarFront,
  BarChart3,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { tokenStore } from '@/auth/tokenStore'
import { useRealtime } from '@/realtime/useRealtime'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import type { UserRole } from '@/types/models'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: UserRole[] // undefined = all roles
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/deliveries', label: 'Deliveries', icon: Truck },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/issues', label: 'Issues', icon: AlertTriangle },
  {
    to: '/drivers',
    label: 'Drivers & Vehicles',
    icon: CarFront,
    roles: ['Administrator', 'DistributionManager'],
  },
  { to: '/organizations', label: 'Organizations', icon: Building2, roles: ['Administrator'] },
  { to: '/users', label: 'Users', icon: Users, roles: ['Administrator'] },
  {
    to: '/analytics',
    label: 'Analytics',
    icon: BarChart3,
    roles: ['Administrator', 'DistributionManager'],
  },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const role = user?.role

  // Live transit-board + alerts feed for the ops console.
  useRealtime(tokenStore.getUserAccess())

  const items = NAV.filter((i) => !i.roles || (role && i.roles.includes(role)))

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-svh">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center border-b px-4 font-semibold">NewsTrack</div>
        <nav className="flex-1 space-y-1 p-2">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 px-1 text-sm">
            <div className="font-medium">{user?.name}</div>
            <div className="text-xs text-muted-foreground">{role}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-end border-b px-6">
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

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
    <div className="flex flex-col min-h-svh font-sans relative overflow-hidden">
      {/* Minimal Professional Background with Subtle Indigo Glow */}
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(0,0,0,0))]" />
      
      {/* Floating Top Navigation */}
      <div className="relative z-20 pt-6 px-6 md:px-8 w-full max-w-7xl mx-auto">
        <header className="flex h-16 shrink-0 items-center justify-between rounded-full border border-white/20 bg-white/10 backdrop-blur-[32px] px-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)]">
          <div className="flex items-center gap-8">
            <div className="font-extrabold text-xl tracking-tighter text-white drop-shadow-md">
              News<span className="text-white/80 font-bold">Track</span>
            </div>
            
            <nav className="hidden md:flex items-center space-x-1">
              {items.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300',
                      isActive
                        ? 'bg-white/20 text-white shadow-md shadow-black/10 backdrop-blur-md border border-white/30'
                        : 'text-white/70 hover:bg-white/10 hover:text-white',
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-white drop-shadow-md"><NotificationBell /></div>
            <div className="h-6 w-px bg-white/20 hidden md:block" />
            <div className="hidden md:flex items-center gap-3">
              <div className="flex flex-col items-end text-right">
                <span className="text-sm font-bold text-white leading-tight drop-shadow-md">{user?.name}</span>
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{role}</span>
              </div>
              <Button variant="outline" size="icon" className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-error transition-colors backdrop-blur-sm shadow-md" onClick={handleLogout}>
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto p-6 md:p-8 mt-2 animate-fadeInUp">
        <Outlet />
      </main>
    </div>
  )
}

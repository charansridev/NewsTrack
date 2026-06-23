/** Authenticated ops-console shell: role-aware sidebar nav + header. */
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Truck,
  BarChart3,
  LogOut,
  Search,
  Bell,
  Settings,
  ShoppingCart,
  Wallet,
  FileText
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { tokenStore } from '@/auth/tokenStore'
import { useRealtime } from '@/realtime/useRealtime'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import type { UserRole } from '@/types/models'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: UserRole[]
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/deliveries', label: 'Deliveries', icon: ShoppingCart }, // Using ShoppingCart for cart icon
  { to: '/products', label: 'Products', icon: Truck },
  { to: '/issues', label: 'Issues', icon: FileText },
  { to: '/drivers', label: 'Drivers', icon: Wallet },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const role = user?.role

  useRealtime(tokenStore.getUserAccess())

  // Check for open issues to show notification badge
  const { data: issuesData } = useQuery({
    queryKey: ['open-issues-count'],
    queryFn: async () => {
      const res = await api.get('/issues', { params: { status: 'Open', page_size: 1 } })
      return res.data
    },
    refetchInterval: 60000,
  })
  const hasOpenIssues = (issuesData?.pagination?.total || 0) > 0

  const items = NAV.filter((i) => !i.roles || (role && i.roles.includes(role)))

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground">
      {/* Sidebar Navigation */}
      <aside className="w-[80px] sm:w-[100px] border-r border-border bg-card flex flex-col items-center py-6 shrink-0 z-20">
        {/* Neon Yellow Logo */}
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground mb-8">
          <div className="flex gap-[2px] items-end pb-[2px]">
            <div className="w-1.5 h-1.5 bg-black rounded-full" />
            <div className="w-1.5 h-3 bg-black rounded-full" />
            <div className="w-1.5 h-2 bg-black rounded-full" />
          </div>
        </div>

        {/* Main Nav Links */}
        <nav className="flex flex-col gap-6 flex-1 items-center w-full">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={label}
              className={({ isActive }) =>
                cn(
                  'p-3 rounded-xl transition-all duration-300 relative group',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              <Icon className="w-6 h-6" />
            </NavLink>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-6 items-center w-full mt-auto text-muted-foreground">
          <button className="p-3 rounded-xl hover:text-foreground transition-colors" title="Settings">
            <Settings className="w-6 h-6" />
          </button>
          <button className="p-3 rounded-xl hover:text-foreground transition-colors" title="Logout" onClick={handleLogout}>
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-[90px] flex shrink-0 items-center justify-between px-6 md:px-8 z-10">
          {/* Search Bar */}
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px]" />
            <Input 
              className="w-full bg-card border-none pl-12 pr-4 text-[15px] rounded-full h-12 placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-primary/50" 
              placeholder="Search" 
            />
          </div>

          {/* User Profile Info */}
          <div className="flex items-center gap-5 sm:gap-6">
            <button className="relative w-10 h-10 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors">
              <Bell className="w-5 h-5" />
              {hasOpenIssues && (
                <span className="absolute top-0 right-0 w-3 h-3 bg-primary border-2 border-background rounded-full animate-pulse" />
              )}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-border bg-[#202020] flex items-center justify-center text-primary font-bold text-sm">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="font-semibold text-foreground text-[15px] leading-tight">{user?.name || 'System Admin'}</span>
                <span className="text-muted-foreground text-xs font-medium capitalize">{user?.role?.replace(/([A-Z])/g, ' $1').trim() || 'Admin'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Outlet */}
        <main className="flex-1 overflow-y-auto px-6 md:px-8 pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

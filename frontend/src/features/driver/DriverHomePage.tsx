import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { tokenStore } from '@/auth/tokenStore'
import { useDriverAuth } from '@/auth/DriverAuthContext'
import { useRealtime } from '@/realtime/useRealtime'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DeliveryStatusBadge } from '@/components/StatusBadge'
import { ActorRefView } from '@/components/ActorRefView'
import type { Delivery, Paged } from '@/types/models'

export default function DriverHomePage() {
  const navigate = useNavigate()
  const { logout } = useDriverAuth()

  // Driver session is the separate JWT system. Hooks must run unconditionally,
  // so gate the query on the token and guard the render below.
  const token = tokenStore.getDriverAccess()
  const hasToken = Boolean(token)

  // Subscribes to realtime updates so the driver sees new assignments immediately
  useRealtime(token)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['driver', 'deliveries'],
    queryFn: async () => {
      const res = await api.get<Paged<Delivery>>('/driver/me/deliveries', {
        audience: 'driver',
      })
      return res.data
    },
    enabled: hasToken,
  })

  function handleLogout() {
    logout()
    navigate('/driver/login', { replace: true })
  }

  if (!hasToken) return <Navigate to="/driver/login" replace />

  return (
    <div className="flex flex-col min-h-svh font-sans relative overflow-hidden p-4">
      {/* Minimal Professional Background with Subtle Indigo Glow */}
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(0,0,0,0))]" />

      <div className="relative z-10 mx-auto w-full max-w-md animate-fadeInUp">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white drop-shadow-sm">My deliveries</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
        {isLoading && <p className="text-white/60">Loading…</p>}
        {isError && <p className="text-error">Could not load your deliveries.</p>}
        
        {data && (() => {
          const newDeliveries = data.data.filter((d) => d.status === 'Created')
          const activeDeliveries = data.data.filter((d) => d.status !== 'Created' && d.status !== 'Delivered' && d.status !== 'Terminated')

          return (
            <>
              {newDeliveries.length > 0 && (
                <div className="mb-6">
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-indigo-400">Newly Assigned</h2>
                  <div className="space-y-3">
                    {newDeliveries.map((d) => (
                      <Card
                        key={d.id}
                        className="cursor-pointer border-indigo-500/50 bg-indigo-500/10 shadow-indigo-500/20"
                        onClick={() => navigate(`/driver/deliveries/${d.id}`)}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center justify-between text-base text-white">
                            <ActorRefView actor={d.recipient} />
                            <DeliveryStatusBadge status={d.status} />
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-white/80">
                          {d.recipient_address_snapshot ?? '—'}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-white/50">Active Deliveries</h2>
                {activeDeliveries.map((d) => (
                  <Card
                    key={d.id}
                    className="cursor-pointer bg-white/5 border-white/10"
                    onClick={() => navigate(`/driver/deliveries/${d.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-base text-white/90">
                        <ActorRefView actor={d.recipient} />
                        <DeliveryStatusBadge status={d.status} />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-white/60">
                      {d.recipient_address_snapshot ?? '—'}
                    </CardContent>
                  </Card>
                ))}
                
                {data.data.length === 0 && (
                  <p className="text-white/60">No deliveries assigned right now.</p>
                )}
              </div>
            </>
          )
        })()}
      </div>
    </div>
  )
}

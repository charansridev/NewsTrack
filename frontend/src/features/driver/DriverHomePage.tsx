import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { tokenStore } from '@/auth/tokenStore'
import { useDriverAuth } from '@/auth/DriverAuthContext'
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
  const hasToken = Boolean(tokenStore.getDriverAccess())

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
    <div className="mx-auto max-w-md p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">My deliveries</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Sign out
        </Button>
      </div>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {isError && <p className="text-destructive">Could not load your deliveries.</p>}
      <div className="space-y-3">
        {data?.data?.map((d) => (
          <Card
            key={d.id}
            className="cursor-pointer"
            onClick={() => navigate(`/driver/deliveries/${d.id}`)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <ActorRefView actor={d.recipient} />
                <DeliveryStatusBadge status={d.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {d.recipient_address_snapshot ?? '—'}
            </CardContent>
          </Card>
        ))}
        {data && data.data.length === 0 && (
          <p className="text-muted-foreground">No deliveries assigned right now.</p>
        )}
      </div>
    </div>
  )
}

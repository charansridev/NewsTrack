import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiClientError } from '@/api/client'
import { tokenStore } from '@/auth/tokenStore'
import { formatQty } from '@/lib/format'
import { DeliveryStatusBadge, ItemStatusBadge } from '@/components/StatusBadge'
import { ActorRefView } from '@/components/ActorRefView'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import type { Delivery, DeliveryStatus, Paged } from '@/types/models'

// Driver-facing transit transitions only.
const DRIVER_STATUSES: DeliveryStatus[] = ['Dispatched', 'OutForDelivery', 'Delivered']
const ISSUE_TYPES = ['Vehicle Breakdown', 'Route Block', 'Quantity Shortage', 'Delivery Delay', 'Other']

function useDriverDelivery(id: string | undefined) {
  return useQuery({
    queryKey: ['driver', 'deliveries'],
    queryFn: async () => {
      const res = await api.get<Paged<Delivery>>('/driver/me/deliveries', { audience: 'driver' })
      return res.data.data
    },
    enabled: Boolean(id),
    select: (list) => list.find((d) => d.id === id),
  })
}

export default function DriverDeliveryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const hasToken = Boolean(tokenStore.getDriverAccess())

  const { data: delivery, isLoading } = useDriverDelivery(hasToken ? id : undefined)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['driver', 'deliveries'] })

  const advance = useMutation({
    mutationFn: async (status: DeliveryStatus) => {
      await api.post(`/deliveries/${id}/status`, { status }, { audience: 'driver' })
    },
    onSuccess: () => {
      void invalidate()
      toast.success('Status updated.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not update status.'),
  })

  if (!hasToken) return <Navigate to="/driver/login" replace />

  const frozen = delivery ? (delivery.status === 'Delivered' || delivery.status === 'Terminated') : false

  return (
    <div className="flex flex-col min-h-svh font-sans relative overflow-hidden p-4">
      {/* Minimal Professional Background with Subtle Indigo Glow */}
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(0,0,0,0))]" />

      <div className="relative z-10 mx-auto w-full max-w-md space-y-4 animate-fadeInUp">
        {isLoading ? (
          <Skeleton className="h-60 w-full" />
        ) : !delivery ? (
          <div className="space-y-4 text-center py-8">
            <p className="text-error font-medium">Delivery not found among your assignments.</p>
            <Button variant="outline" onClick={() => navigate('/driver')}>
              Back to deliveries
            </Button>
          </div>
        ) : (
          <>
            <Button variant="ghost" size="sm" className="-ml-2 text-white/80 hover:text-white" onClick={() => navigate('/driver')}>
              <ArrowLeft className="size-4" />
              My deliveries
            </Button>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <ActorRefView actor={delivery.recipient} />
                  <DeliveryStatusBadge status={delivery.status} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-white/70">
                <p>{delivery.recipient_address_snapshot ?? '—'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Manifest</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-white">
                {(delivery.items ?? []).map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-white/70">{i.product_id?.slice(0, 10)}</span>
                    <span>{formatQty(i.expected_quantity)}</span>
                    <ItemStatusBadge status={i.status} />
                  </div>
                ))}
                {(delivery.items ?? []).length === 0 && (
                  <p className="text-sm text-white/60">No items.</p>
                )}
              </CardContent>
            </Card>

            {!frozen && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Update status</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {DRIVER_STATUSES.map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      disabled={advance.isPending}
                      onClick={() => advance.mutate(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}

            {(delivery.status === 'OutForDelivery' || delivery.status === 'Delivered') &&
              !delivery.confirmed_at && <DriverConfirm delivery={delivery} onDone={invalidate} />}

            <DriverRaiseIssue deliveryId={delivery.id!} />
          </>
        )}
      </div>
    </div>
  )
}

function DriverConfirm({ delivery, onDone }: { delivery: Delivery; onDone: () => void }) {
  const items = delivery.items ?? []
  const [photo, setPhoto] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id!, i.expected_quantity ?? 0])),
  )
  const confirm = useMutation({
    mutationFn: async () => {
      await api.post(
        `/deliveries/${delivery.id}/confirm`,
        {
          photo_url: photo || undefined,
          items: items.map((i) => ({ item_id: i.id!, confirmed_quantity: quantities[i.id!] ?? 0 })),
        },
        { audience: 'driver' },
      )
    },
    onSuccess: () => {
      onDone()
      toast.success('Delivery confirmed.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not confirm.'),
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Confirm delivery</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-white">
        <div className="space-y-2">
          <Label htmlFor="d-photo" className="text-white/80">Photo URL (optional)</Label>
          <Input id="d-photo" value={photo} onChange={(e) => setPhoto(e.target.value)} />
        </div>
        {items.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-2">
            <span className="text-sm text-white/80">Expected {formatQty(i.expected_quantity)}</span>
            <Input
              type="number"
              className="w-28"
              value={quantities[i.id!] ?? 0}
              onChange={(e) => setQuantities((q) => ({ ...q, [i.id!]: Number(e.target.value) }))}
            />
          </div>
        ))}
        <Button className="w-full shadow-md" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
          {confirm.isPending ? 'Confirming…' : 'Confirm'}
        </Button>
      </CardContent>
    </Card>
  )
}

function DriverRaiseIssue({ deliveryId }: { deliveryId: string }) {
  const [type, setType] = useState(ISSUE_TYPES[0])
  const [title, setTitle] = useState('')
  const raise = useMutation({
    mutationFn: async () => {
      await api.post('/issues', { type, title, delivery_id: deliveryId }, { audience: 'driver' })
    },
    onSuccess: () => {
      setTitle('')
      toast.success('Issue raised.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not raise issue.'),
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Report a problem</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <select
          className="h-10 w-full rounded-2xl border border-white/30 bg-[#161618] text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {ISSUE_TYPES.map((t) => (
            <option key={t} value={t} className="bg-[#161618] text-white">
              {t}
            </option>
          ))}
        </select>
        <Textarea placeholder="What happened?" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button
          variant="outline"
          className="w-full"
          disabled={!title || raise.isPending}
          onClick={() => raise.mutate()}
        >
          Raise issue
        </Button>
      </CardContent>
    </Card>
  )
}

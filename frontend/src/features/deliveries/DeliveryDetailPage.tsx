import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  useDelivery,
  useDeliveryLogs,
  useAssignmentLogs,
} from '@/api/deliveries'
import { formatDateTime, formatDuration, formatQty } from '@/lib/format'
import { DeliveryStatusBadge, AllocationStatusBadge } from '@/components/StatusBadge'
import { ActorRefView } from '@/components/ActorRefView'
import { StatusDialog } from './StatusDialog'
import { AssignDialog } from './AssignDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { RaiseIssueDialog } from '@/features/issues/RaiseIssueDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const FROZEN = ['Delivered', 'Terminated']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  )
}

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: delivery, isLoading, isError } = useDelivery(id)

  if (isLoading) return <Skeleton className="h-72 w-full" />
  if (isError || !delivery)
    return <p className="text-destructive">Could not load this delivery.</p>

  const isFrozen = delivery.status ? FROZEN.includes(delivery.status) : false
  const canConfirm = delivery.status === 'OutForDelivery' || delivery.status === 'Delivered'
  const alreadyConfirmed = Boolean(delivery.confirmed_at)

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/deliveries')}>
          <ArrowLeft className="size-4" />
          Deliveries
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              Delivery {delivery.id?.slice(0, 8)}
            </h1>
            <DeliveryStatusBadge status={delivery.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isFrozen && <StatusDialog deliveryId={delivery.id!} />}
            {!isFrozen && <AssignDialog delivery={delivery} />}
            {canConfirm && !alreadyConfirmed && <ConfirmDialog delivery={delivery} />}
            <RaiseIssueDialog deliveryId={delivery.id!} />
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-3">
          <Field label="Sender">
            <ActorRefView actor={delivery.sender} />
          </Field>
          <Field label="Recipient">
            <ActorRefView actor={delivery.recipient} />
          </Field>
          <Field label="Type">{delivery.type}</Field>
          <Field label="From">{delivery.sender_address_snapshot ?? '—'}</Field>
          <Field label="To">{delivery.recipient_address_snapshot ?? '—'}</Field>
          <Field label="Planned duration">{formatDuration(delivery.planned_duration)}</Field>
          <Field label="Created">{formatDateTime(delivery.created_at)}</Field>
          <Field label="Confirmed">
            {delivery.confirmed_at ? formatDateTime(delivery.confirmed_at) : '—'}
          </Field>
          <Field label="Driver / Vehicle">
            {delivery.driver_id ? delivery.driver_id.slice(0, 8) : '—'}
            {delivery.vehicle_id ? ` · ${delivery.vehicle_id.slice(0, 8)}` : ''}
          </Field>
        </CardContent>
      </Card>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Manifest</TabsTrigger>
          <TabsTrigger value="logs">Event log</TabsTrigger>
          <TabsTrigger value="assignments">Assignment history</TabsTrigger>
        </TabsList>
        <TabsContent value="items">
          <AllocationsTable delivery={delivery} />
        </TabsContent>
        <TabsContent value="logs">
          <LogsTable id={delivery.id!} />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentTable id={delivery.id!} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AllocationsTable({ delivery }: { delivery: import('@/types/models').Delivery }) {
  const allocations = delivery.allocations ?? []
  return (
    <Card className="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Expected</TableHead>
            <TableHead className="text-right">Confirmed</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allocations.map((i) => (
            <TableRow key={i.allocation_id}>
              <TableCell className="font-mono text-xs">{i.inventory_id?.slice(0, 12)}</TableCell>
              <TableCell className="text-right">{formatQty(i.expected_quantity)}</TableCell>
              <TableCell className="text-right">{formatQty(i.confirmed_quantity)}</TableCell>
              <TableCell>
                <AllocationStatusBadge status={i.status} />
              </TableCell>
            </TableRow>
          ))}
          {allocations.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No items on this delivery.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  )
}

function LogsTable({ id }: { id: string }) {
  const { data: logs, isLoading } = useDeliveryLogs(id)
  if (isLoading) return <Skeleton className="h-40 w-full" />
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Event log</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {logs?.map((l) => (
          <div key={l.id} className="flex items-start justify-between gap-4 text-sm">
            <div>
              <span className="font-medium">{l.action}</span>
              {l.remark && <span className="text-muted-foreground"> — {l.remark}</span>}
            </div>
            <span className="shrink-0 text-muted-foreground">{formatDateTime(l.timestamp)}</span>
          </div>
        ))}
        {logs && logs.length === 0 && (
          <p className="text-sm text-muted-foreground">No log entries yet.</p>
        )}
      </CardContent>
    </Card>
  )
}

function AssignmentTable({ id }: { id: string }) {
  const { data: logs, isLoading } = useAssignmentLogs(id)
  if (isLoading) return <Skeleton className="h-40 w-full" />
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Assignment history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {logs?.map((l) => (
          <div key={l.id} className="flex items-start justify-between gap-4 text-sm">
            <span className="font-medium">{l.action}</span>
            <span className="shrink-0 text-muted-foreground">{formatDateTime(l.timestamp)}</span>
          </div>
        ))}
        {logs && logs.length === 0 && (
          <p className="text-sm text-muted-foreground">No assignment changes recorded.</p>
        )}
      </CardContent>
    </Card>
  )
}

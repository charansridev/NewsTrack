import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useDeliveries, type DeliveryFilters } from '@/api/deliveries'
import { DELIVERY_STATUSES } from '@/lib/enums'
import { formatDateTime, formatDuration } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { DeliveryStatusBadge } from '@/components/StatusBadge'
import { ActorRefView } from '@/components/ActorRefView'
import { CreateDeliveryDialog } from './CreateDeliveryDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { DeliveryStatus } from '@/types/models'

const PAGE_SIZE = 25
const ALL = '__all__'

export default function DeliveriesPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<DeliveryStatus | undefined>(undefined)
  const [onlyIssues, setOnlyIssues] = useState(false)

  const filters: DeliveryFilters = {
    page,
    page_size: PAGE_SIZE,
    sort: 'created_at:desc',
    status,
    has_issue: onlyIssues || undefined,
  }
  const { data, isLoading, isError } = useDeliveries(filters)

  function changeStatus(value: string) {
    setStatus(value === ALL ? undefined : (value as DeliveryStatus))
    setPage(1)
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Deliveries"
        description="Live status board and historical lookup."
        actions={<CreateDeliveryDialog />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={status ?? ALL} onValueChange={changeStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {DELIVERY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={onlyIssues ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setOnlyIssues((v) => !v)
            setPage(1)
          }}
        >
          <AlertTriangle className="size-4" />
          With issues
        </Button>
      </div>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Sender</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Planned</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Issues</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {isError && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-destructive">
                  Could not load deliveries.
                </TableCell>
              </TableRow>
            )}
            {data?.data?.map((d, index) => (
              <TableRow
                key={d.id}
                className="cursor-pointer hover:-translate-y-[1px] transition-transform animate-fadeInUp"
                style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
                onClick={() => navigate(`/deliveries/${d.id}`)}
              >
                <TableCell>
                  <DeliveryStatusBadge status={d.status} />
                </TableCell>
                <TableCell>
                  <ActorRefView actor={d.sender} />
                </TableCell>
                <TableCell>
                  <ActorRefView actor={d.recipient} />
                </TableCell>
                <TableCell>{formatDuration(d.planned_duration)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(d.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  {d.has_issue ? (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <AlertTriangle className="size-4" />
                      {d.issue_count ?? 1}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {data && data.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No deliveries match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Pagination pagination={data?.pagination} page={page} onPageChange={setPage} />
    </div>
  )
}

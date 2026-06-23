import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Loader2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
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

      <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {[{ id: ALL, label: 'All statuses' }, ...DELIVERY_STATUSES.map(s => ({ id: s, label: s }))].map((tab) => (
          <button
            key={tab.id}
            onClick={() => changeStatus(tab.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border",
              (status === tab.id || (tab.id === ALL && !status))
                ? "bg-primary text-black border-primary" 
                : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
        <Button
          variant={onlyIssues ? 'default' : 'outline'}
          className={cn(
            "rounded-full transition-all ml-auto",
            onlyIssues ? "bg-red-500 text-white border-red-500 hover:bg-red-600" : "border-border text-muted-foreground hover:text-foreground"
          )}
          size="sm"
          onClick={() => {
            setOnlyIssues((v) => !v)
            setPage(1)
          }}
        >
          <AlertTriangle className="size-4 mr-2" />
          With issues
        </Button>
      </div>

      <div className="bg-card rounded-[24px] p-6 border border-border flex flex-col flex-1 min-h-[500px] mb-6">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_2fr_2fr_1fr_1fr_1fr_auto] text-xs font-medium text-muted-foreground pb-4 border-b border-border/50 gap-4">
          <div>Status</div>
          <div>Sender</div>
          <div>Recipient</div>
          <div>Planned</div>
          <div>Created</div>
          <div className="text-right">Issues</div>
          <div className="w-8"></div>
        </div>

        {/* Table List */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center pt-10">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="flex-1 flex items-center justify-center text-destructive text-sm pt-10">
              Could not load deliveries.
            </div>
          ) : data?.data?.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm pt-10">
              No deliveries match these filters.
            </div>
          ) : (
            data?.data?.map((d, index) => (
              <div
                key={d.id}
                onClick={() => navigate(`/deliveries/${d.id}`)}
                className="grid grid-cols-[1fr_2fr_2fr_1fr_1fr_1fr_auto] items-center text-sm py-4 border-b border-border/50 hover:bg-[#202020] transition-colors px-2 -mx-2 rounded-lg cursor-pointer animate-fadeInUp gap-4"
                style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
              >
                <div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[11px] font-bold inline-flex items-center justify-center",
                    d.status === 'Dispatched' || d.status === 'OutForDelivery' ? "bg-primary text-black" :
                    d.status === 'Delivered' ? "bg-[#33ff33] text-black" :
                    d.status === 'Terminated' ? "bg-red-500 text-white" :
                    "bg-[#e2e2e2] text-black"
                  )}>
                    {d.status}
                  </span>
                </div>
                <div className="truncate"><ActorRefView actor={d.sender} /></div>
                <div className="truncate"><ActorRefView actor={d.recipient} /></div>
                <div className="text-muted-foreground">{formatDuration(d.planned_duration)}</div>
                <div className="text-muted-foreground text-xs">{formatDateTime(d.created_at)}</div>
                <div className="text-right">
                  {d.has_issue ? (
                    <span className="inline-flex items-center gap-1 text-red-500 font-semibold">
                      <AlertTriangle className="size-3" />
                      {d.issue_count ?? 1}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="flex justify-end w-8">
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Pagination pagination={data?.pagination} page={page} onPageChange={setPage} />
    </div>
  )
}

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useRoutePerformance,
  useDeliverySuccess,
  exportReportPdf,
} from '@/api/analytics'
import { formatDuration } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'


export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader title="Analytics" description="Route performance and delivery success." />
      <Tabs defaultValue="routes">
        <TabsList>
          <TabsTrigger value="routes">Route performance</TabsTrigger>
          <TabsTrigger value="success">Delivery success</TabsTrigger>
        </TabsList>
        <TabsContent value="routes">
          <RoutePerformanceTab />
        </TabsContent>
        <TabsContent value="success">
          <DeliverySuccessTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function RoutePerformanceTab() {
  const { data, isLoading } = useRoutePerformance()
  return (
    <div className="flex flex-col h-[calc(100vh-230px)] gap-4 animate-fadeIn mt-4">
      <div className="flex justify-end">
        <Button className="bg-[#202020] text-foreground hover:bg-[#2a2a2a] rounded-full transition-colors border border-border" size="sm" onClick={() => exportReportPdf('route-performance')}>
          <Download className="size-4 mr-2" />
          Export PDF
        </Button>
      </div>
      <div className="bg-card rounded-[24px] p-6 border border-border flex flex-col flex-1 min-h-[400px]">
        {/* Table Header */}
        <div className="grid grid-cols-[3fr_1fr_1fr_2fr_1fr] text-xs font-medium text-muted-foreground pb-4 border-b border-border/50 gap-4">
          <div>Route (sender → recipient)</div>
          <div className="text-right">Runs</div>
          <div className="text-right">Avg</div>
          <div className="text-right">Min / Max</div>
          <div className="text-right pr-2">On-time</div>
        </div>

        {/* Table List */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center pt-10">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : data?.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm pt-10">
              No route data.
            </div>
          ) : (
            data?.map((r, i) => (
              <div 
                key={i} 
                className="grid grid-cols-[3fr_1fr_1fr_2fr_1fr] items-center text-sm py-4 border-b border-border/50 hover:bg-[#202020] transition-colors px-2 -mx-2 rounded-lg gap-4"
              >
                <div className="font-mono text-xs text-foreground truncate">
                  {r.sender_address_id?.slice(0, 8)} <span className="text-muted-foreground">→</span> {r.recipient_address_id?.slice(0, 8)}
                </div>
                <div className="text-right font-medium">{r.total_runs}</div>
                <div className="text-right">{formatDuration(Math.round(r.avg_duration))}</div>
                <div className="text-right text-muted-foreground text-xs">
                  {formatDuration(r.min_duration)} <span className="mx-1">/</span> {formatDuration(r.max_duration)}
                </div>
                <div className="text-right font-semibold text-primary pr-2">{r.on_time_pct?.toFixed(2)}%</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function DeliverySuccessTab() {
  const [groupBy, setGroupBy] = useState<'route' | 'vendor' | 'hub'>('vendor')
  const { data, isLoading } = useDeliverySuccess(groupBy)
  return (
    <div className="flex flex-col h-[calc(100vh-230px)] gap-4 animate-fadeIn mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {[{ id: 'route', label: 'By route' }, { id: 'vendor', label: 'By vendor' }, { id: 'hub', label: 'By hub' }].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setGroupBy(tab.id as 'route' | 'vendor' | 'hub')}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border",
                groupBy === tab.id
                  ? "bg-primary text-black border-primary" 
                  : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button className="bg-[#202020] text-foreground hover:bg-[#2a2a2a] rounded-full transition-colors border border-border" size="sm" onClick={() => exportReportPdf('delivery-success')}>
          <Download className="size-4 mr-2" />
          Export PDF
        </Button>
      </div>

      <div className="bg-card rounded-[24px] p-6 border border-border flex flex-col flex-1 min-h-[400px]">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] text-xs font-medium text-muted-foreground pb-4 border-b border-border/50 gap-4">
          <div>Key</div>
          <div className="text-right">Success</div>
          <div className="text-right">Delivered</div>
          <div className="text-right">Missed</div>
          <div className="text-right pr-2">Total</div>
        </div>

        {/* Table List */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center pt-10">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : data?.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm pt-10">
              No data.
            </div>
          ) : (
            data?.map((row, i) => (
              <div 
                key={i} 
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center text-sm py-4 border-b border-border/50 hover:bg-[#202020] transition-colors px-2 -mx-2 rounded-lg gap-4"
              >
                <div className="font-mono text-xs text-foreground truncate">{row.key}</div>
                <div className="text-right font-semibold text-primary">{row.success_rate?.toFixed(2)}%</div>
                <div className="text-right text-[#33ff33]">{row.delivered}</div>
                <div className="text-right text-red-500">{row.missed}</div>
                <div className="text-right font-medium pr-2">{row.total}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

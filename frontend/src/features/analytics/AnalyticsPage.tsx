import { useState } from 'react'
import { Download } from 'lucide-react'
import {
  useRoutePerformance,
  useDeliverySuccess,
  exportReportPdf,
} from '@/api/analytics'
import { formatDuration } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => exportReportPdf('route-performance')}>
          <Download className="size-4" />
          Export PDF
        </Button>
      </div>
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Route (sender → recipient)</TableHead>
              <TableHead className="text-right">Runs</TableHead>
              <TableHead className="text-right">Avg</TableHead>
              <TableHead className="text-right">Min / Max</TableHead>
              <TableHead className="text-right">On-time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            )}
            {data?.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">
                  {r.sender_address_id?.slice(0, 8)} → {r.recipient_address_id?.slice(0, 8)}
                </TableCell>
                <TableCell className="text-right">{r.total_runs}</TableCell>
                <TableCell className="text-right">{formatDuration(Math.round(r.avg_duration))}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatDuration(r.min_duration)} / {formatDuration(r.max_duration)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.on_time_pct?.toFixed(2)}%</TableCell>
              </TableRow>
            ))}
            {data && data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No route data.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

function DeliverySuccessTab() {
  const [groupBy, setGroupBy] = useState<'route' | 'vendor' | 'hub'>('vendor')
  const { data, isLoading } = useDeliverySuccess(groupBy)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="route">By route</SelectItem>
            <SelectItem value="vendor">By vendor</SelectItem>
            <SelectItem value="hub">By hub</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => exportReportPdf('delivery-success')}>
          <Download className="size-4" />
          Export PDF
        </Button>
      </div>
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead className="text-right">Success</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Missed</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            )}
            {data?.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{row.key}</TableCell>
                <TableCell className="text-right tabular-nums">{row.success_rate?.toFixed(2)}%</TableCell>
                <TableCell className="text-right">{row.delivered}</TableCell>
                <TableCell className="text-right">{row.missed}</TableCell>
                <TableCell className="text-right">{row.total}</TableCell>
              </TableRow>
            ))}
            {data && data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No data.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

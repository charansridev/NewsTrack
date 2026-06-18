import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DailySummary {
  date: string
  bundles_created: number
  dispatched: number
  delivered: number
  pending: number
  missed_deliveries: number
  delays: number
  issues_raised: number
}

const KPIS: { key: keyof Omit<DailySummary, 'date'>; label: string }[] = [
  { key: 'bundles_created', label: 'Bundles created' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'pending', label: 'Pending' },
  { key: 'missed_deliveries', label: 'Missed' },
  { key: 'delays', label: 'Delays' },
  { key: 'issues_raised', label: 'Issues raised' },
]

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['daily-summary'],
    queryFn: async () => {
      const res = await api.get<DailySummary>('/reports/daily-summary')
      return res.data
    },
    refetchInterval: 60_000,
  })

  return (
    <div>
      <PageHeader title="Dashboard" description="Today's distribution at a glance." />
      {isError && <p className="text-sm text-destructive">Could not load the daily summary.</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {KPIS.map(({ key, label }) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {isLoading ? '—' : (data?.[key] ?? 0)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

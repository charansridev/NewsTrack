import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

/** Today's date as YYYY-MM-DD for the date input default. */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function DashboardPage() {
  const [date, setDate] = useState(today())

  const { data, isLoading, isError } = useQuery({
    queryKey: ['daily-summary', date],
    queryFn: async () => {
      const res = await api.get<DailySummary>('/reports/daily-summary', { params: { date } })
      return res.data
    },
    refetchInterval: 60_000,
  })

  const isEmpty = !isLoading && data && KPIS.every(({ key }) => !data[key])

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Distribution summary for the selected day."
        actions={
          <div className="flex items-center gap-2">
            <Label htmlFor="summary-date" className="text-sm text-muted-foreground">
              Date
            </Label>
            <Input
              id="summary-date"
              type="date"
              className="w-40"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value || today())}
            />
          </div>
        }
      />
      {isError && <p className="text-sm text-destructive">Could not load the daily summary.</p>}
      {isEmpty && (
        <p className="mb-4 text-sm text-muted-foreground">
          No activity recorded on {date}. Try an earlier date.
        </p>
      )}
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

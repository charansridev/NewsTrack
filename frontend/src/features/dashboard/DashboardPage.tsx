import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { cn } from '@/lib/utils'
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

function getKPIColor() {
  return 'text-white drop-shadow-sm'
}

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
    <div className="animate-fadeIn">
      <PageHeader
        title="Dashboard"
        description="Distribution summary for the selected day."
        actions={
          <div className="flex items-center gap-2">
            <Label htmlFor="summary-date" className="text-sm text-white/80 font-bold">
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
      {isError && <p className="text-sm text-error font-medium">Could not load the daily summary.</p>}
      {isEmpty && (
        <p className="mb-4 text-sm text-on-surface-variant">
          No activity recorded on {date}. Try an earlier date.
        </p>
      )}
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {KPIS.map(({ key, label }, index) => {
          const colorClass = getKPIColor();
          return (
            <Card key={key} className="group hover:-translate-y-1 hover:shadow-[0_12px_40px_0_rgba(0,0,0,0.3)] transition-all duration-500 ease-out animate-fadeInUp" style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold tracking-tight text-white/70 group-hover:text-white transition-colors">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn("text-5xl font-extrabold tracking-tighter transition-transform duration-500 group-hover:scale-105 origin-left", colorClass)}>
                  {isLoading ? '—' : (data?.[key] ?? 0)}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

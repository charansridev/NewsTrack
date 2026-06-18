/** Hooks for routes & analytics reporting + PDF export. */
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiClientError } from '@/api/client'

export interface RoutePerf {
  sender_address_id: string
  recipient_address_id: string
  total_runs: number
  min_duration: number
  max_duration: number
  avg_duration: number
  on_time_pct: number
  delay_frequency: number
}

export interface SuccessRow {
  key: string
  success_rate: number
  total: number
  delivered: number
  missed: number
}

export function useRoutePerformance() {
  return useQuery({
    queryKey: ['routes', 'performance'],
    queryFn: async () => {
      const res = await api.get<{ data: RoutePerf[] }>('/routes/performance')
      return res.data.data
    },
  })
}

export function useDeliverySuccess(groupBy: 'route' | 'vendor' | 'hub') {
  return useQuery({
    queryKey: ['reports', 'delivery-success', groupBy],
    queryFn: async () => {
      const res = await api.get<{ group_by: string; data: SuccessRow[] }>(
        '/reports/delivery-success',
        { params: { group_by: groupBy } },
      )
      return res.data.data
    },
  })
}

export type ReportName =
  | 'daily-summary'
  | 'delivery-success'
  | 'route-performance'
  | 'vendor-performance'

/** Downloads a report PDF (returns application/pdf binary). */
export async function exportReportPdf(report: ReportName) {
  try {
    const res = await api.get('/reports/export', {
      params: { report },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    toast.error(e instanceof ApiClientError ? e.message : 'Export failed.')
  }
}

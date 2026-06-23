import { useState } from 'react'
import { ArrowUpRight, Loader2 } from 'lucide-react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { api } from '@/api/client'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('Created')

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })

  const queryResults = useQueries({
    queries: dates.map(date => ({
      queryKey: ['daily-summary', date],
      queryFn: async () => {
        const res = await api.get('/reports/daily-summary', { params: { date } })
        return res.data
      },
      staleTime: 60000,
    }))
  })

  const { data: vehiclesData } = useQuery({
    queryKey: ['kpi-vehicles'],
    queryFn: async () => {
      const res = await api.get('/vehicles', { params: { page_size: 1 } })
      return res.data
    },
    staleTime: 60000,
  })

  const { data: deliveriesData, isLoading: deliveriesLoading } = useQuery({
    queryKey: ['deliveries-list', activeTab],
    queryFn: async () => {
      const res = await api.get('/deliveries', { params: { status: activeTab, page_size: 10 } })
      return res.data
    },
    staleTime: 60000,
  })
  const deliveriesList = deliveriesData?.data || []

  const todaySummary = queryResults[6]?.data

  const KPIS = [
    { 
      label: 'On-Time Deliveries', 
      value: todaySummary ? `${Math.round(((todaySummary.delivered - (todaySummary.delays || 0)) / Math.max(1, todaySummary.delivered)) * 100)}%` : '...', 
      sub: todaySummary ? `Based on ${todaySummary.delivered} deliveries` : 'Loading...', 
      highlight: true 
    },
    { 
      label: 'Total Deliveries', 
      value: todaySummary ? `${todaySummary.delivered}` : '...', 
      sub: todaySummary ? `${todaySummary.pending} pending` : 'Loading...', 
      highlight: false 
    },
    { 
      label: 'Total Vehicles', 
      value: vehiclesData ? `${vehiclesData.pagination?.total || 0}` : '...', 
      sub: 'Active fleet', 
      highlight: false 
    },
    { 
      label: 'Driver Behavior Score', 
      value: todaySummary ? `${Math.max(0, 100 - ((todaySummary.issues_raised || 0) * 2))}%` : '...', 
      sub: todaySummary ? `${todaySummary.issues_raised || 0} issues today` : 'Loading...', 
      highlight: false 
    },
  ]

  const isLoadingActivity = queryResults.some(q => q.isLoading)
  const activityData = queryResults.map((q, i) => {
    const data = q.data || { dispatched: 0, delivered: 0 }
    const dateStr = new Date(dates[i]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return {
      date: dateStr,
      val1: data.dispatched || 0,
      val2: data.delivered || 0,
      active: i === 6 // make today active
    }
  })

  const maxVal = Math.max(10, ...activityData.map(d => Math.max(d.val1, d.val2)))
  const yAxisMax = Math.ceil(maxVal / 10) * 10

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-10">
      
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((kpi, i) => (
          <div 
            key={i} 
            className={cn(
              "rounded-[24px] p-6 flex flex-col justify-between h-[160px] relative overflow-hidden group transition-transform hover:-translate-y-1",
              kpi.highlight ? "bg-primary text-black" : "bg-card text-foreground border border-border"
            )}
          >
            <div className="flex justify-between items-start">
              <span className={cn("text-[15px] font-medium", kpi.highlight ? "text-black/80" : "text-muted-foreground")}>
                {kpi.label}
              </span>
              <button 
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                  kpi.highlight ? "bg-black text-primary hover:bg-black/80" : "border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                )}
              >
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight">{kpi.value}</span>
                <span className={cn("text-xs font-medium", kpi.highlight ? "text-black/70" : "text-muted-foreground")}>
                  {kpi.sub}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col xl:grid xl:grid-cols-3 gap-6">
        
        {/* Left Column / Activity */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          
          {/* Activity Chart */}
          <div className="bg-card rounded-[24px] p-6 border border-border flex flex-col h-[380px]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-[20px] font-medium">Activity</h3>
            </div>
            
            <div className="flex-1 flex flex-col justify-end relative">
              {isLoadingActivity ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Y Axis Labels */}
                  <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-muted-foreground">
                    <span>{yAxisMax}</span>
                    <span>{Math.round(yAxisMax * 0.8)}</span>
                    <span>{Math.round(yAxisMax * 0.6)}</span>
                    <span>{Math.round(yAxisMax * 0.4)}</span>
                    <span>{Math.round(yAxisMax * 0.2)}</span>
                    <span>0</span>
                  </div>

                  {/* Chart Bars */}
                  <div className="flex justify-between items-end h-[200px] pl-8 pb-4">
                    {activityData.map((col, i) => (
                      <div key={i} className="flex flex-col items-center gap-3 relative group cursor-pointer">
                        <div className="absolute -top-14 bg-white text-black text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap shadow-xl z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {col.date}<br/>
                          <span className="font-normal text-black/70">{col.val2} orders</span>
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45" />
                        </div>
                        <div className="flex items-end h-[160px]">
                          <div 
                            className="w-6 rounded-sm transition-all duration-500 bg-primary"
                            style={{ height: `${Math.min(100, (col.val2 / yAxisMax) * 100)}%` }} 
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground font-medium">{col.date}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Deliveries */}
        <div className="xl:col-span-2 bg-card rounded-[24px] p-6 border border-border flex flex-col min-h-[380px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[20px] font-medium">Deliveries</h3>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            {['Created', 'Packed', 'Dispatched', 'OutForDelivery', 'Delivered'].map((tabId) => (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border",
                  activeTab === tabId 
                    ? "bg-primary text-black border-primary" 
                    : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                )}
              >
                {tabId}
              </button>
            ))}
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[1fr_2fr_1fr_1fr] text-xs font-medium text-muted-foreground pb-4 border-b border-border/50">
            <div>Delivery ID</div>
            <div>Recipient</div>
            <div>Date</div>
            <div>Status</div>
          </div>

          {/* Table List */}
          <div className="flex flex-col flex-1 overflow-y-auto">
            {deliveriesLoading ? (
              <div className="flex-1 flex items-center justify-center pt-10">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : deliveriesList.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm pt-10">
                No deliveries found.
              </div>
            ) : (
              deliveriesList.map((delivery: any) => (
                <div 
                  key={delivery.id} 
                  className="grid grid-cols-[1fr_2fr_1fr_1fr] items-center text-sm py-4 border-b border-border/50 hover:bg-[#202020] transition-colors px-2 -mx-2 rounded-lg"
                >
                  <div className="text-muted-foreground truncate pr-2" title={delivery.id}>
                    #{delivery.id.split('-')[0]}
                  </div>
                  <div className="truncate pr-4" title={delivery.recipient?.name}>
                    {delivery.recipient?.name || 'Unknown'}
                  </div>
                  <div className="text-muted-foreground">
                    {new Date(delivery.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                  <div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[11px] font-bold inline-flex items-center justify-center",
                      delivery.status === 'Dispatched' || delivery.status === 'OutForDelivery'
                        ? "bg-primary text-black" 
                        : "bg-[#e2e2e2] text-black"
                    )}>
                      {delivery.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

      </div>
    </div>
  )
}

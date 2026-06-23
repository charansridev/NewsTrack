import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIssues, type IssueFilters } from '@/api/issues'
import { ISSUE_STATUSES } from '@/lib/enums'
import { formatDateTime } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { ActorRefView } from '@/components/ActorRefView'

import type { IssueStatus } from '@/types/models'

const PAGE_SIZE = 25
const ALL = '__all__'

export default function IssuesPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<IssueStatus | undefined>(undefined)

  const filters: IssueFilters = { page, page_size: PAGE_SIZE, status }
  const { data, isLoading, isError } = useIssues(filters)

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-4 animate-fadeIn">
      <PageHeader title="Issues" description="Operational problems and their resolution." />

      <div className="flex items-center gap-3 mb-2 overflow-x-auto pb-2 scrollbar-hide">
        {[{ id: ALL, label: 'All statuses' }, ...ISSUE_STATUSES.map(s => ({ id: s, label: s }))].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setStatus(tab.id === ALL ? undefined : (tab.id as IssueStatus))
              setPage(1)
            }}
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
      </div>

      <div className="bg-card rounded-[24px] p-6 border border-border flex flex-col flex-1 min-h-[400px]">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_1fr_3fr_2fr_1fr_auto] text-xs font-medium text-muted-foreground pb-4 border-b border-border/50 gap-4">
          <div>Status</div>
          <div>Type</div>
          <div>Title</div>
          <div>Assigned to</div>
          <div>Created</div>
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
              Could not load issues.
            </div>
          ) : data?.data?.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm pt-10">
              No issues match these filters.
            </div>
          ) : (
            data?.data?.map((issue, index) => (
              <div
                key={issue.id}
                onClick={() => navigate(`/issues/${issue.id}`)}
                className="grid grid-cols-[1fr_1fr_3fr_2fr_1fr_auto] items-center text-sm py-4 border-b border-border/50 hover:bg-[#202020] transition-colors px-2 -mx-2 rounded-lg cursor-pointer animate-fadeInUp gap-4"
                style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
              >
                <div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[11px] font-bold inline-flex items-center justify-center",
                    issue.status === 'Open' ? "bg-red-500 text-white" :
                    issue.status === 'Resolved' ? "bg-[#33ff33] text-black" :
                    "bg-[#e2e2e2] text-black"
                  )}>
                    {issue.status}
                  </span>
                </div>
                <div className="text-muted-foreground">{issue.type}</div>
                <div className="font-semibold text-foreground truncate pr-4">{issue.title}</div>
                <div className="truncate"><ActorRefView actor={issue.assigned_to} /></div>
                <div className="text-muted-foreground text-xs">{formatDateTime(issue.created_at)}</div>
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

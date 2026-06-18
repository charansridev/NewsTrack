import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIssues, type IssueFilters } from '@/api/issues'
import { ISSUE_STATUSES } from '@/lib/enums'
import { formatDateTime } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { IssueStatusBadge } from '@/components/StatusBadge'
import { ActorRefView } from '@/components/ActorRefView'
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
    <div>
      <PageHeader title="Issues" description="Operational problems and their resolution." />

      <div className="mb-4">
        <Select
          value={status ?? ALL}
          onValueChange={(v) => {
            setStatus(v === ALL ? undefined : (v as IssueStatus))
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {ISSUE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Assigned to</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {isError && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-destructive">
                  Could not load issues.
                </TableCell>
              </TableRow>
            )}
            {data?.data?.map((issue) => (
              <TableRow
                key={issue.id}
                className="cursor-pointer"
                onClick={() => navigate(`/issues/${issue.id}`)}
              >
                <TableCell>
                  <IssueStatusBadge status={issue.status} />
                </TableCell>
                <TableCell>{issue.type}</TableCell>
                <TableCell className="font-medium">{issue.title}</TableCell>
                <TableCell>
                  <ActorRefView actor={issue.assigned_to} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(issue.created_at)}
                </TableCell>
              </TableRow>
            ))}
            {data && data.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No issues match these filters.
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

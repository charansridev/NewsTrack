import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  useIssue,
  useIssueLogs,
  useAssignIssue,
  useChangeIssueStatus,
  useAddIssueComment,
} from '@/api/issues'
import { ISSUE_STATUSES } from '@/lib/enums'
import { formatDateTime } from '@/lib/format'
import { IssueStatusBadge } from '@/components/StatusBadge'
import { ActorRefView } from '@/components/ActorRefView'
import { ActorPicker } from '@/components/ActorPicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { IssueStatus } from '@/types/models'

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: issue, isLoading } = useIssue(id)

  if (isLoading) return <Skeleton className="h-72 w-full" />
  if (!issue) return <p className="text-destructive">Could not load this issue.</p>

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/issues')}>
          <ArrowLeft className="size-4" />
          Issues
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{issue.title}</h1>
            <IssueStatusBadge status={issue.status} />
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{issue.type}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm">{issue.description || 'No description provided.'}</p>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Delivery</div>
              {issue.delivery_id ? (
                <Link
                  to={`/deliveries/${issue.delivery_id}`}
                  className="underline underline-offset-4"
                >
                  {issue.delivery_id.slice(0, 8)}
                </Link>
              ) : (
                '—'
              )}
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Assigned to</div>
              <ActorRefView actor={issue.assigned_to} />
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Deadline</div>
              {formatDateTime(issue.deadline)}
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Created by</div>
              <ActorRefView actor={issue.created_by} />
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Created</div>
              {formatDateTime(issue.created_at)}
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Resolved</div>
              {formatDateTime(issue.resolved_at)}
            </div>
          </div>
          {issue.resolution_note && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <span className="font-medium">Resolution: </span>
              {issue.resolution_note}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <AssignSection issueId={issue.id!} />
        <StatusSection issueId={issue.id!} current={issue.status} />
      </div>

      <CommentsSection issueId={issue.id!} />
    </div>
  )
}

function AssignSection({ issueId }: { issueId: string }) {
  const [assignee, setAssignee] = useState<string>()
  const [deadline, setDeadline] = useState('')
  const assign = useAssignIssue(issueId)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Assign / reassign</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Assignee</Label>
          <ActorPicker value={assignee} onChange={setAssignee} placeholder="Select assignee" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deadline">Deadline (optional)</Label>
          <Input
            id="deadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
        <Button
          disabled={!assignee || assign.isPending}
          onClick={() =>
            assign.mutate({
              assigned_to: { universal_id: assignee! },
              deadline: deadline ? new Date(deadline).toISOString() : undefined,
            })
          }
        >
          {assign.isPending ? 'Saving…' : 'Assign'}
        </Button>
      </CardContent>
    </Card>
  )
}

function StatusSection({ issueId, current }: { issueId: string; current?: IssueStatus }) {
  const [status, setStatus] = useState<IssueStatus | ''>(current ?? '')
  const [note, setNote] = useState('')
  const change = useChangeIssueStatus(issueId)
  const needsNote = status === 'Resolved'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Change status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as IssueStatus)}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {ISSUE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {needsNote && (
          <div className="space-y-2">
            <Label htmlFor="note">Resolution note (required)</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        )}
        <Button
          disabled={!status || (needsNote && !note) || change.isPending}
          onClick={() =>
            change.mutate({
              status: status as IssueStatus,
              resolution_note: needsNote ? note : undefined,
            })
          }
        >
          {change.isPending ? 'Saving…' : 'Update status'}
        </Button>
      </CardContent>
    </Card>
  )
}

function CommentsSection({ issueId }: { issueId: string }) {
  const { data: logs, isLoading } = useIssueLogs(issueId)
  const [comment, setComment] = useState('')
  const add = useAddIssueComment(issueId)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Activity &amp; comments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Add a comment…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button
            disabled={!comment || add.isPending}
            onClick={() => add.mutate(comment, { onSuccess: () => setComment('') })}
          >
            Post
          </Button>
        </div>
        {isLoading && <Skeleton className="h-24 w-full" />}
        <div className="space-y-3">
          {logs?.map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-4 text-sm">
              <div>
                <span className="font-medium">{l.action}</span>
                {l.remark && <span className="text-muted-foreground"> — {l.remark}</span>}
              </div>
              <span className="shrink-0 text-muted-foreground">{formatDateTime(l.created_at)}</span>
            </div>
          ))}
          {logs && logs.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

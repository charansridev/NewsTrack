/** TanStack Query hooks for the Issues domain. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiClientError } from '@/api/client'
import type { Issue, IssueLog, IssueStatus, Paged } from '@/types/models'

export interface IssueFilters {
  page?: number
  page_size?: number
  status?: IssueStatus
  type?: string
  delivery_id?: string
}

export const issueKeys = {
  list: (f: IssueFilters) => ['issues', 'list', f] as const,
  detail: (id: string) => ['issues', 'detail', id] as const,
  logs: (id: string) => ['issues', id, 'logs'] as const,
}

export function useIssues(filters: IssueFilters) {
  return useQuery({
    queryKey: issueKeys.list(filters),
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''),
      )
      const res = await api.get<Paged<Issue>>('/issues', { params })
      return res.data
    },
    placeholderData: (prev) => prev,
  })
}

export function useIssue(id: string | undefined) {
  return useQuery({
    queryKey: issueKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await api.get<Issue>(`/issues/${id}`)
      return res.data
    },
    enabled: Boolean(id),
  })
}

export function useIssueLogs(id: string | undefined) {
  return useQuery({
    queryKey: issueKeys.logs(id ?? ''),
    queryFn: async () => {
      const res = await api.get<Paged<IssueLog>>(`/issues/${id}/logs`)
      return res.data.data
    },
    enabled: Boolean(id),
  })
}

export function useRaiseIssue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      type: string
      title: string
      description?: string
      delivery_id: string
    }) => {
      const res = await api.post<Issue>('/issues', body)
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['issues', 'list'] })
      void qc.invalidateQueries({ queryKey: ['deliveries'] })
      toast.success('Issue raised.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not raise issue.'),
  })
}

function useIssueInvalidation(id: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: issueKeys.detail(id) })
    void qc.invalidateQueries({ queryKey: ['issues', 'list'] })
    void qc.invalidateQueries({ queryKey: issueKeys.logs(id) })
  }
}

export function useAssignIssue(id: string) {
  const invalidate = useIssueInvalidation(id)
  return useMutation({
    mutationFn: async (body: { assigned_to: { universal_id: string }; deadline?: string; remark?: string }) => {
      const res = await api.post<Issue>(`/issues/${id}/assign`, body)
      return res.data
    },
    onSuccess: () => {
      invalidate()
      toast.success('Issue assigned.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not assign issue.'),
  })
}

export function useChangeIssueStatus(id: string) {
  const invalidate = useIssueInvalidation(id)
  return useMutation({
    mutationFn: async (body: { status: IssueStatus; resolution_note?: string; remark?: string }) => {
      const res = await api.post<Issue>(`/issues/${id}/status`, body)
      return res.data
    },
    onSuccess: () => {
      invalidate()
      toast.success('Issue updated.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not update issue.'),
  })
}

export function useAddIssueComment(id: string) {
  const invalidate = useIssueInvalidation(id)
  return useMutation({
    mutationFn: async (remark: string) => {
      const res = await api.post<IssueLog>(`/issues/${id}/logs`, { remark })
      return res.data
    },
    onSuccess: () => {
      invalidate()
      toast.success('Comment added.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not add comment.'),
  })
}

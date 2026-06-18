/** Shared lookups: organizations, users, addresses. Reused by issues, admin, create-delivery. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiClientError } from '@/api/client'
import type {
  Organization,
  User,
  Address,
  OrgType,
  UserRole,
  Paged,
} from '@/types/models'

export function useOrganizations(params?: { type?: OrgType; page?: number; page_size?: number }) {
  return useQuery({
    queryKey: ['organizations', params ?? {}],
    queryFn: async () => {
      const res = await api.get<Paged<Organization>>('/organizations', {
        params: { page_size: 200, ...params },
      })
      return res.data
    },
  })
}

export function useUsers(params?: { role?: UserRole; organization_id?: string; page?: number }) {
  return useQuery({
    queryKey: ['users', params ?? {}],
    queryFn: async () => {
      const res = await api.get<Paged<User>>('/users', {
        params: { page_size: 200, ...params },
      })
      return res.data
    },
  })
}

export function useAddresses() {
  return useQuery({
    queryKey: ['addresses'],
    queryFn: async () => {
      const res = await api.get<Paged<Address>>('/addresses', { params: { page_size: 200 } })
      return res.data.data
    },
  })
}

export function useCreateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<Organization>) => {
      const res = await api.post<Organization>('/organizations', body)
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['organizations'] })
      toast.success('Organization created.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not create organization.'),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<User>) => {
      const res = await api.post<User>('/users', body)
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not create user.'),
  })
}

export interface OrgPerformance {
  organization_id: string
  delivery_success_rate: number
  avg_confirmation_minutes: number
  missed_deliveries: number
  issues_raised: number
}

export function useOrgPerformance(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organizations', orgId, 'performance'],
    queryFn: async () => {
      const res = await api.get<OrgPerformance>(`/organizations/${orgId}/performance`)
      return res.data
    },
    enabled: Boolean(orgId),
  })
}

export function useCreateAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (address: string) => {
      const res = await api.post<Address>('/addresses', { address })
      return res.data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['addresses'] }),
  })
}

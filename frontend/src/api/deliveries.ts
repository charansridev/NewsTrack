/** TanStack Query hooks for the Deliveries domain. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiClientError } from '@/api/client'
import type {
  Delivery,
  DeliveryLog,
  DeliveryAssignmentLog,
  DeliveryStatus,
  Driver,
  Vehicle,
  Paged,
} from '@/types/models'

export interface DeliveryFilters {
  page?: number
  page_size?: number
  status?: DeliveryStatus
  has_issue?: boolean
  driver_id?: string
  sort?: string
  from?: string
  to?: string
}

export const deliveryKeys = {
  all: ['deliveries'] as const,
  list: (filters: DeliveryFilters) => ['deliveries', 'list', filters] as const,
  detail: (id: string) => ['deliveries', 'detail', id] as const,
  logs: (id: string) => ['deliveries', id, 'logs'] as const,
  assignmentLogs: (id: string) => ['deliveries', id, 'assignment-logs'] as const,
}

export function useDeliveries(filters: DeliveryFilters) {
  return useQuery({
    queryKey: deliveryKeys.list(filters),
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''),
      )
      const res = await api.get<Paged<Delivery>>('/deliveries', { params })
      return res.data
    },
    placeholderData: (prev) => prev,
  })
}

export interface CreateDeliveryInput {
  type: 'Delivery' | 'Handend'
  sender: { universal_id: string }
  recipient: { universal_id: string }
  sender_address_id?: string
  recipient_address_id?: string
  planned_duration?: number
  note?: string
  items?: { product_id: string; expected_quantity: number }[]
}

export function useCreateDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateDeliveryInput) => {
      const res = await api.post<Delivery>('/deliveries', body)
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deliveries', 'list'] })
      toast.success('Delivery created.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not create delivery.'),
  })
}

export function useDelivery(id: string | undefined) {
  return useQuery({
    queryKey: deliveryKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await api.get<Delivery>(`/deliveries/${id}`)
      return res.data
    },
    enabled: Boolean(id),
  })
}

export function useDeliveryLogs(id: string | undefined) {
  return useQuery({
    queryKey: deliveryKeys.logs(id ?? ''),
    queryFn: async () => {
      const res = await api.get<Paged<DeliveryLog>>(`/deliveries/${id}/logs`)
      return res.data.data
    },
    enabled: Boolean(id),
  })
}

export function useAssignmentLogs(id: string | undefined) {
  return useQuery({
    queryKey: deliveryKeys.assignmentLogs(id ?? ''),
    queryFn: async () => {
      const res = await api.get<Paged<DeliveryAssignmentLog>>(
        `/deliveries/${id}/assignment-logs`,
      )
      return res.data.data
    },
    enabled: Boolean(id),
  })
}

function useDeliveryInvalidation(id: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: deliveryKeys.detail(id) })
    void qc.invalidateQueries({ queryKey: ['deliveries', 'list'] })
    void qc.invalidateQueries({ queryKey: deliveryKeys.logs(id) })
  }
}

export function useAdvanceStatus(id: string) {
  const invalidate = useDeliveryInvalidation(id)
  return useMutation({
    mutationFn: async (body: { status: DeliveryStatus; remark?: string }) => {
      const res = await api.post<Delivery>(`/deliveries/${id}/status`, body)
      return res.data
    },
    onSuccess: (d) => {
      invalidate()
      toast.success(`Status advanced to ${d.status}.`)
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not update status.'),
  })
}

export function useAssign(id: string) {
  const invalidate = useDeliveryInvalidation(id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { driver_id?: string | null; vehicle_id?: string | null; remark?: string }) => {
      const res = await api.post<Delivery>(`/deliveries/${id}/assign`, body)
      return res.data
    },
    onSuccess: () => {
      invalidate()
      void qc.invalidateQueries({ queryKey: deliveryKeys.assignmentLogs(id) })
      toast.success('Assignment updated.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not assign.'),
  })
}

export interface ConfirmPayload {
  photo_url?: string
  allocations?: { allocation_id: string; confirmed_quantity: number }[]
}

export function useConfirm(id: string) {
  const invalidate = useDeliveryInvalidation(id)
  return useMutation({
    mutationFn: async (body: ConfirmPayload) => {
      const res = await api.post<Delivery>(`/deliveries/${id}/confirm`, body)
      return res.data
    },
    onSuccess: () => {
      invalidate()
      toast.success('Delivery confirmed.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not confirm.'),
  })
}

// Supporting lookups for the assign dialog.
export function useAvailableDrivers() {
  return useQuery({
    queryKey: ['drivers', 'available'],
    queryFn: async () => {
      const res = await api.get<Paged<Driver>>('/drivers', { params: { page_size: 200 } })
      return res.data.data
    },
  })
}

export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles', 'all'],
    queryFn: async () => {
      const res = await api.get<Paged<Vehicle>>('/vehicles', { params: { page_size: 200 } })
      return res.data.data
    },
  })
}

export type { Delivery }

/** TanStack Query hooks for drivers and vehicles. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiClientError } from '@/api/client'
import type { Driver, Vehicle, Paged } from '@/types/models'

export function useDrivers() {
  return useQuery({
    queryKey: ['drivers', 'list'],
    queryFn: async () => {
      const res = await api.get<Paged<Driver>>('/drivers', { params: { page_size: 200 } })
      return res.data.data
    },
  })
}

export function useVehicleList() {
  return useQuery({
    queryKey: ['vehicles', 'list'],
    queryFn: async () => {
      const res = await api.get<Paged<Vehicle>>('/vehicles', { params: { page_size: 200 } })
      return res.data.data
    },
  })
}

export function useCreateDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<Driver>) => {
      const res = await api.post<Driver>('/drivers', body)
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['drivers'] })
      toast.success('Driver registered.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not register driver.'),
  })
}

export function useUpdateDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<Driver> }) => {
      const res = await api.patch<Driver>(`/drivers/${id}`, body)
      return res.data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['drivers'] }),
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not update driver.'),
  })
}

export function useCreateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<Vehicle>) => {
      const res = await api.post<Vehicle>('/vehicles', body)
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success('Vehicle registered.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not register vehicle.'),
  })
}

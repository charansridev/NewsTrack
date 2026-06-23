import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Paged } from '@/types/models'

export interface ProductInventory {
  inventory_id: string
  product_id: string
  organization_id: string
  received_stock: number
  current_stock: number
  status?: string
  other_info?: Record<string, any>
  created_at: string
  updated_at: string
}

export function useInventory(params?: { page?: number; page_size?: number; product_id?: string; organization_id?: string; status?: string }) {
  return useQuery({
    queryKey: ['inventory', params ?? {}],
    queryFn: async () => {
      const res = await api.get<Paged<ProductInventory>>('/inventory', {
        params: { page_size: 50, ...params },
      })
      return res.data
    },
    placeholderData: (prev) => prev,
  })
}

/** TanStack Query hooks for products / bundles. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiClientError } from '@/api/client'
import type { Product, Paged } from '@/types/models'

export function useProducts(params?: { page?: number; page_size?: number; name?: string }) {
  return useQuery({
    queryKey: ['products', params ?? {}],
    queryFn: async () => {
      const res = await api.get<Paged<Product>>('/products', {
        params: { page_size: 50, ...params },
      })
      return res.data
    },
    placeholderData: (prev) => prev,
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<Product>) => {
      const res = await api.post<Product>('/products', body)
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product created.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not create product.'),
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<Product> }) => {
      const res = await api.patch<Product>(`/products/${id}`, body)
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product updated.')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Could not update product.'),
  })
}

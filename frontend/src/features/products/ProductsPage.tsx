import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useProducts, useCreateProduct } from '@/api/products'
import { useInventory } from '@/api/inventory'
import { formatDateTime, formatQty } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { MetadataFields } from '@/components/MetadataFields'
import { metadataSpec, buildMetadata } from '@/lib/metadataSchemas'

const PAGE_SIZE = 25
const PRODUCT_SPEC = metadataSpec('product')

export default function ProductsPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-4 pb-4">
      <PageHeader
        title="Products & Inventory"
        description="Catalog of bundles / editions and authoritative inventory stock levels."
        actions={<CreateProductDialog />}
      />
      
      <Tabs defaultValue="products" className="flex flex-col flex-1 h-full">
        <TabsList className="w-full max-w-[400px]">
          <TabsTrigger value="products" className="flex-1">Product Catalog</TabsTrigger>
          <TabsTrigger value="inventory" className="flex-1">Inventory</TabsTrigger>
        </TabsList>
        
        <TabsContent value="products" className="flex-1 min-h-0 mt-4">
          <ProductsTab />
        </TabsContent>
        
        <TabsContent value="inventory" className="flex-1 min-h-0 mt-4">
          <InventoryTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ProductsTab() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useProducts({ page, page_size: PAGE_SIZE })

  return (
    <div className="bg-card rounded-[24px] p-6 border border-border flex flex-col h-full">
      {/* Table Header */}
      <div className="grid grid-cols-[2fr_2fr_1fr] text-xs font-medium text-muted-foreground pb-4 border-b border-border/50 gap-4">
        <div>Name</div>
        <div>SKU / ID</div>
        <div className="text-right">Created</div>
      </div>

      {/* Table List */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center pt-10">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : data?.data?.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm pt-10">
            No products in catalog yet.
          </div>
        ) : (
          data?.data?.map((p) => (
            <div 
              key={p.product_id} 
              className="grid grid-cols-[2fr_2fr_1fr] items-center text-sm py-4 border-b border-border/50 hover:bg-[#202020] transition-colors px-2 -mx-2 rounded-lg gap-4"
            >
              <div className="font-semibold text-foreground truncate">{p.name}</div>
              <div className="text-muted-foreground font-mono text-xs truncate">
                {p.sku || p.product_id?.split('-')[0]}
              </div>
              <div className="text-muted-foreground text-xs text-right">
                {formatDateTime(p.created_at)}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-auto pt-4 border-t border-border/50">
        <Pagination pagination={data?.pagination} page={page} onPageChange={setPage} />
      </div>
    </div>
  )
}

function InventoryTab() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useInventory({ page, page_size: PAGE_SIZE })

  return (
    <div className="bg-card rounded-[24px] p-6 border border-border flex flex-col h-full">
      {/* Table Header */}
      <div className="grid grid-cols-[2fr_2fr_1fr_1fr] text-xs font-medium text-muted-foreground pb-4 border-b border-border/50 gap-4">
        <div>Product ID</div>
        <div>Organization ID</div>
        <div className="text-right">Current Stock</div>
        <div className="text-right">Received Stock</div>
      </div>

      {/* Table List */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center pt-10">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : data?.data?.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm pt-10">
            No inventory records found.
          </div>
        ) : (
          data?.data?.map((inv) => (
            <div 
              key={inv.inventory_id} 
              className="grid grid-cols-[2fr_2fr_1fr_1fr] items-center text-sm py-4 border-b border-border/50 hover:bg-[#202020] transition-colors px-2 -mx-2 rounded-lg gap-4"
            >
              <div className="font-mono text-xs text-muted-foreground truncate" title={inv.product_id}>
                {inv.product_id}
              </div>
              <div className="font-mono text-xs text-muted-foreground truncate" title={inv.organization_id}>
                {inv.organization_id}
              </div>
              <div className="text-right font-medium text-foreground">
                {formatQty(inv.current_stock)}
              </div>
              <div className="text-right text-muted-foreground">
                {formatQty(inv.received_stock)}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-auto pt-4 border-t border-border/50">
        <Pagination pagination={data?.pagination} page={page} onPageChange={setPage} />
      </div>
    </div>
  )
}

function CreateProductDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [description, setDescription] = useState('')
  const [meta, setMeta] = useState<Record<string, string>>({})
  const create = useCreateProduct()

  async function submit() {
    const other_info = buildMetadata(PRODUCT_SPEC, meta)
    await create.mutateAsync({
      name,
      sku: sku || undefined,
      short_description: shortDescription || undefined,
      description: description || undefined,
      other_info: Object.keys(other_info).length ? other_info : undefined,
    })
    setOpen(false)
    setName('')
    setSku('')
    setShortDescription('')
    setDescription('')
    setMeta({})
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New product</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Create product / bundle</DialogTitle>
          <DialogDescription>
            Only Administrators and Press-org members may create products. Stock levels are initialized via inventory delivery or administrative operations.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-sku">SKU</Label>
            <Input id="p-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-short">Short description</Label>
            <Input
              id="p-short"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <MetadataFields
            spec={PRODUCT_SPEC}
            values={meta}
            onChange={(k, v) => setMeta((m) => ({ ...m, [k]: v }))}
            title="Bundle metadata"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

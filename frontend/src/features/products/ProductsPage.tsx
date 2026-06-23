import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProducts, useCreateProduct, useUpdateProduct } from '@/api/products'
import { formatDateTime, formatQty } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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
  const [page, setPage] = useState(1)
  const { data, isLoading } = useProducts({ page, page_size: PAGE_SIZE })
  const update = useUpdateProduct()

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-4">
      <PageHeader
        title="Products"
        description="Bundles / editions. Stock is set at production and reduced on dispatch."
        actions={<CreateProductDialog />}
      />
      <div className="bg-card rounded-[24px] p-6 border border-border flex flex-col flex-1 min-h-0">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_1fr_2fr_auto] text-xs font-medium text-muted-foreground pb-4 border-b border-border/50">
          <div>Name</div>
          <div className="text-right">Stock</div>
          <div className="pl-6">Created</div>
          <div className="w-48 text-right">Adjust stock</div>
        </div>

        {/* Table List */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center pt-10">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : data?.data?.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm pt-10">
              No products yet.
            </div>
          ) : (
            data?.data?.map((p) => (
              <div 
                key={p.product_id} 
                className="grid grid-cols-[2fr_1fr_2fr_auto] items-center text-sm py-4 border-b border-border/50 hover:bg-[#202020] transition-colors px-2 -mx-2 rounded-lg"
              >
                <div className="font-semibold text-foreground truncate pr-4">{p.name}</div>
                <div className="text-right font-medium">{formatQty(p.stocks)}</div>
                <div className="text-muted-foreground text-xs pl-6">{formatDateTime(p.created_at)}</div>
                <div className="flex justify-end w-48">
                  <StockEditor
                    current={p.stocks ?? 0}
                    onSave={(stocks) => update.mutate({ id: p.product_id!, body: { stocks } })}
                  />
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

function StockEditor({ current, onSave }: { current: number; onSave: (stocks: number) => void }) {
  const [value, setValue] = useState(String(current))
  const dirty = Number(value) !== current
  return (
    <div className="flex items-center justify-end gap-2">
      <Input
        type="number"
        className="h-8 w-20 bg-[#1a1a1a] border-border text-center rounded-lg focus-visible:ring-1 focus-visible:ring-primary/50"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button 
        size="sm" 
        className={cn(
          "rounded-full h-8 px-4 transition-colors",
          dirty ? "bg-primary text-black hover:bg-primary/90" : "bg-[#202020] text-muted-foreground hover:bg-[#202020] opacity-50"
        )}
        disabled={!dirty} 
        onClick={() => {
          onSave(Number(value))
        }}
      >
        Save
      </Button>
    </div>
  )
}

function CreateProductDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [stocks, setStocks] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [description, setDescription] = useState('')
  const [meta, setMeta] = useState<Record<string, string>>({})
  const create = useCreateProduct()

  async function submit() {
    const other_info = buildMetadata(PRODUCT_SPEC, meta)
    await create.mutateAsync({
      name,
      stocks: stocks ? Number(stocks) : undefined,
      short_description: shortDescription || undefined,
      description: description || undefined,
      other_info: Object.keys(other_info).length ? other_info : undefined,
    })
    setOpen(false)
    setName('')
    setStocks('')
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
            Only Administrators and Press-org members may create products. The owning organization
            is derived from your account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-stock">Initial stock</Label>
            <Input
              id="p-stock"
              type="number"
              value={stocks}
              onChange={(e) => setStocks(e.target.value)}
            />
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

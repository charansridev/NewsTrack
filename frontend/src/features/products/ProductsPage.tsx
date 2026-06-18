import { useState } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PAGE_SIZE = 25

export default function ProductsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useProducts({ page, page_size: PAGE_SIZE })
  const update = useUpdateProduct()

  return (
    <div>
      <PageHeader
        title="Products"
        description="Bundles / editions. Stock is set at production and reduced on dispatch."
        actions={<CreateProductDialog />}
      />
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-32 text-right">Adjust stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {data?.data?.map((p) => (
              <TableRow key={p.product_id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-right tabular-nums">{formatQty(p.stocks)}</TableCell>
                <TableCell className="text-muted-foreground">{formatDateTime(p.created_at)}</TableCell>
                <TableCell className="text-right">
                  <StockEditor
                    current={p.stocks ?? 0}
                    onSave={(stocks) => update.mutate({ id: p.product_id!, body: { stocks } })}
                  />
                </TableCell>
              </TableRow>
            ))}
            {data && data.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No products yet.
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

function StockEditor({ current, onSave }: { current: number; onSave: (stocks: number) => void }) {
  const [value, setValue] = useState(String(current))
  const dirty = Number(value) !== current
  return (
    <div className="flex items-center justify-end gap-1">
      <Input
        type="number"
        className="h-8 w-24"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button size="sm" variant="outline" disabled={!dirty} onClick={() => onSave(Number(value))}>
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
  const create = useCreateProduct()

  async function submit() {
    await create.mutateAsync({
      name,
      stocks: stocks ? Number(stocks) : undefined,
      short_description: shortDescription || undefined,
      description: description || undefined,
    })
    setOpen(false)
    setName('')
    setStocks('')
    setShortDescription('')
    setDescription('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New product</Button>
      </DialogTrigger>
      <DialogContent>
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

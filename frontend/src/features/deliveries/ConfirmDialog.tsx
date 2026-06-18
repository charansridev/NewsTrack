import { useState } from 'react'
import { useConfirm } from '@/api/deliveries'
import { formatQty } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { Delivery } from '@/types/models'

export function ConfirmDialog({ delivery }: { delivery: Delivery }) {
  const [open, setOpen] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const items = delivery.items ?? []
  // Pre-fill confirmed quantity with expected; confirmer adjusts on mismatch.
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id!, i.expected_quantity ?? 0])),
  )
  const confirm = useConfirm(delivery.id!)

  async function submit() {
    await confirm.mutateAsync({
      photo_url: photoUrl || undefined,
      items: items.map((i) => ({
        item_id: i.id!,
        confirmed_quantity: quantities[i.id!] ?? 0,
      })),
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Confirm delivery</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm delivery</DialogTitle>
          <DialogDescription>
            Record received quantities and optional photo proof. A quantity mismatch flags the
            item as a discrepancy. Once confirmed the record is immutable.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="photo">Photo URL (optional)</Label>
            <Input
              id="photo"
              placeholder="https://…"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            {items.map((i) => (
              <div key={i.id} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div className="text-sm">
                  <div className="font-medium">Item {i.product_id?.slice(0, 8)}</div>
                  <div className="text-muted-foreground">
                    Expected {formatQty(i.expected_quantity)}
                  </div>
                </div>
                <Input
                  type="number"
                  className="w-32"
                  value={quantities[i.id!] ?? 0}
                  onChange={(e) =>
                    setQuantities((q) => ({ ...q, [i.id!]: Number(e.target.value) }))
                  }
                />
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">This delivery has no items.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={confirm.isPending}>
            {confirm.isPending ? 'Confirming…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

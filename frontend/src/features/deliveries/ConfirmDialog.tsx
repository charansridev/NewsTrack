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
  const allocations = delivery.allocations ?? []
  // Pre-fill confirmed quantity with expected; confirmer adjusts on mismatch.
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(allocations.map((i) => [i.allocation_id!, i.expected_quantity ?? 0])),
  )
  const confirm = useConfirm(delivery.id!)

  async function submit() {
    await confirm.mutateAsync({
      photo_url: photoUrl || undefined,
      allocations: allocations.map((i) => ({
        allocation_id: i.allocation_id!,
        confirmed_quantity: quantities[i.allocation_id!] ?? 0,
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
          <div className="space-y-4 py-4">
            {allocations.length > 0 ? (
              allocations.map((i) => (
                <div key={i.allocation_id} className="grid grid-cols-3 items-center gap-4 text-sm">
                  <div className="col-span-2 font-mono text-xs">{i.inventory_id?.slice(0, 12)}</div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="h-8 text-right"
                      value={quantities[i.allocation_id!] ?? 0}
                      onChange={(e) =>
                        setQuantities({ ...quantities, [i.allocation_id!]: Number(e.target.value) })
                      }
                    />
                    <span className="text-muted-foreground">/ {formatQty(i.expected_quantity)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No items to confirm.</p>
            )}
            <div className="space-y-2"></div>
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

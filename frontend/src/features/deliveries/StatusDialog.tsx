import { useState } from 'react'
import { useAdvanceStatus } from '@/api/deliveries'
import { DELIVERY_STATUSES } from '@/lib/enums'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DeliveryStatus } from '@/types/models'

export function StatusDialog({ deliveryId }: { deliveryId: string }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<DeliveryStatus | ''>('')
  const [remark, setRemark] = useState('')
  const advance = useAdvanceStatus(deliveryId)

  async function submit() {
    if (!status) return
    await advance.mutateAsync({ status, remark: remark || undefined })
    setOpen(false)
    setStatus('')
    setRemark('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Advance status</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Advance delivery status</DialogTitle>
          <DialogDescription>
            Each transition is recorded in the delivery log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>New status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as DeliveryStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="remark">Remark (optional)</Label>
            <Textarea id="remark" value={remark} onChange={(e) => setRemark(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!status || advance.isPending}>
            {advance.isPending ? 'Saving…' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

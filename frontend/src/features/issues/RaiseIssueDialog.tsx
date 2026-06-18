import { useState } from 'react'
import { useRaiseIssue } from '@/api/issues'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

const TYPES = ['Vehicle Breakdown', 'Route Block', 'Quantity Shortage', 'Delivery Delay', 'Other']

export function RaiseIssueDialog({ deliveryId }: { deliveryId: string }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState(TYPES[0])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const raise = useRaiseIssue()

  async function submit() {
    await raise.mutateAsync({ type, title, description: description || undefined, delivery_id: deliveryId })
    setOpen(false)
    setTitle('')
    setDescription('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Raise issue</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise an issue</DialogTitle>
          <DialogDescription>Flags this delivery for operations follow-up.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="issue-type">Type</Label>
            <select
              id="issue-type"
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="issue-title">Title</Label>
            <Input id="issue-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="issue-desc">Description</Label>
            <Textarea
              id="issue-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title || raise.isPending}>
            {raise.isPending ? 'Saving…' : 'Raise issue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCreateDelivery, type CreateDeliveryInput } from '@/api/deliveries'
import { AssignDialog } from './AssignDialog'
import type { Delivery } from '@/types/models'
import { useAddresses, useOrganizations } from '@/api/references'
import { useProducts } from '@/api/products'
import { useAuth } from '@/auth/AuthContext'
import { ActorPicker } from '@/components/ActorPicker'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ItemRow {
  product_id: string
  expected_quantity: string
}

const NONE = '__none__'

export function CreateDeliveryDialog() {
  const [open, setOpen] = useState(false)
  const [newDelivery, setNewDelivery] = useState<Delivery | null>(null)
  const [type, setType] = useState<'Delivery' | 'Handend'>('Delivery')
  const [sender, setSender] = useState<string>()
  const [recipient, setRecipient] = useState<string>()
  const [senderAddr, setSenderAddr] = useState<string>(NONE)
  const [recipientAddr, setRecipientAddr] = useState<string>(NONE)
  const [planned, setPlanned] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<ItemRow[]>([])

  const { data: addresses } = useAddresses()
  const { data: products } = useProducts({ page_size: 200 })
  const create = useCreateDelivery()

  const { user } = useAuth()
  const { data: orgs } = useOrganizations()
  const isNonAdmin = user?.role !== 'Administrator'

  useEffect(() => {
    if (isNonAdmin && user?.organization_id && orgs?.data) {
      const myOrg = orgs.data.find(o => o.id === user.organization_id)
      if (myOrg && myOrg.universal_id) {
        setSender(myOrg.universal_id)
      }
    }
  }, [user, orgs, isNonAdmin])

  function reset() {
    setSender(undefined)
    setRecipient(undefined)
    setSenderAddr(NONE)
    setRecipientAddr(NONE)
    setPlanned('')
    setNote('')
    setItems([])
  }

  async function submit() {
    if (!sender || !recipient) return
    const body: CreateDeliveryInput = {
      type,
      sender: { universal_id: sender },
      recipient: { universal_id: recipient },
      sender_address_id: senderAddr === NONE ? undefined : senderAddr,
      recipient_address_id: recipientAddr === NONE ? undefined : recipientAddr,
      planned_duration: planned ? Number(planned) : undefined,
      note: note || undefined,
      items: items
        .filter((i) => i.product_id && i.expected_quantity)
        .map((i) => ({ product_id: i.product_id, expected_quantity: Number(i.expected_quantity) })),
    }
    const created = await create.mutateAsync(body)
    setOpen(false)
    reset()
    setNewDelivery(created)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New delivery
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create delivery</DialogTitle>
          <DialogDescription>One movement between two nodes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'Delivery' | 'Handend')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Delivery">Delivery</SelectItem>
                <SelectItem value="Handend">Handend</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Sender</Label>
              <ActorPicker value={sender} onChange={setSender} placeholder="Select sender" disabled={isNonAdmin} />
            </div>
            <div className="space-y-2">
              <Label>Recipient</Label>
              <ActorPicker value={recipient} onChange={setRecipient} placeholder="Select recipient" />
            </div>
            <div className="space-y-2">
              <Label>From address</Label>
              <AddressSelect value={senderAddr} onChange={setSenderAddr} addresses={addresses} />
            </div>
            <div className="space-y-2">
              <Label>To address</Label>
              <AddressSelect value={recipientAddr} onChange={setRecipientAddr} addresses={addresses} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="planned">Planned duration (min)</Label>
            <Input
              id="planned"
              type="number"
              value={planned}
              onChange={(e) => setPlanned(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems([...items, { product_id: '', expected_quantity: '' }])}
              >
                <Plus className="size-4" />
                Add item
              </Button>
            </div>
            {items.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={row.product_id}
                  onValueChange={(v) =>
                    setItems(items.map((r, i) => (i === idx ? { ...r, product_id: v } : r)))
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.data?.map((p) => (
                      <SelectItem key={p.product_id} value={p.product_id!}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Qty"
                  className="w-24"
                  value={row.expected_quantity}
                  onChange={(e) =>
                    setItems(
                      items.map((r, i) =>
                        i === idx ? { ...r, expected_quantity: e.target.value } : r,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!sender || !recipient || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create delivery'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {newDelivery && (
        <AssignDialog
          delivery={newDelivery}
          open={true}
          onOpenChange={(v) => {
            if (!v) setNewDelivery(null)
          }}
          hideTrigger
        />
      )}
    </>
  )
}

function AddressSelect({
  value,
  onChange,
  addresses,
}: {
  value: string
  onChange: (v: string) => void
  addresses?: { id?: string; address?: string }[]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Optional" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>None</SelectItem>
        {addresses?.map((a) => (
          <SelectItem key={a.id} value={a.id!}>
            {a.address}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

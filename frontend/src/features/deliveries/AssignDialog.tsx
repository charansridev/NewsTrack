import { useState } from 'react'
import { useAssign, useAvailableDrivers, useVehicles } from '@/api/deliveries'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Delivery } from '@/types/models'

const NONE = '__none__'

export function AssignDialog({ 
  delivery,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  hideTrigger = false
}: { 
  delivery: Delivery
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen

  const [driverId, setDriverId] = useState<string>(delivery.driver_id ?? NONE)
  const [vehicleId, setVehicleId] = useState<string>(delivery.vehicle_id ?? NONE)
  const [remark, setRemark] = useState('')

  const assign = useAssign(delivery.id!)
  const { data: drivers } = useAvailableDrivers()
  const { data: vehicles } = useVehicles()

  async function submit() {
    await assign.mutateAsync({
      driver_id: driverId === NONE ? null : driverId,
      vehicle_id: vehicleId === NONE ? null : vehicleId,
      remark: remark || undefined,
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline">Assign driver / vehicle</Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign driver &amp; vehicle</DialogTitle>
          <DialogDescription>Changes are recorded in the assignment log.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Driver</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {drivers?.map((d) => (
                  <SelectItem key={d.driver_id} value={d.driver_id!}>
                    {d.driver_name} {d.is_available ? '' : '(busy)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {vehicles?.map((v) => (
                  <SelectItem key={v.vehicle_id} value={v.vehicle_id!}>
                    {v.vehicle_number} · {v.vehicle_type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assign-remark">Remark (optional)</Label>
            <Input
              id="assign-remark"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={assign.isPending}>
            {assign.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

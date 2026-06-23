import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useDrivers,
  useVehicleList,
  useCreateDriver,
  useUpdateDriver,
  useCreateVehicle,
} from '@/api/fleet'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
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

import { MetadataFields } from '@/components/MetadataFields'
import { metadataSpec, buildMetadata } from '@/lib/metadataSchemas'
import type { Vehicle } from '@/types/models'

const DRIVER_SPEC = metadataSpec('driver')
const VEHICLE_SPEC = metadataSpec('vehicle')

export default function FleetPage() {
  return (
    <div>
      <PageHeader title="Drivers & Vehicles" description="Operational registries." />
      <Tabs defaultValue="drivers">
        <TabsList>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
        </TabsList>
        <TabsContent value="drivers">
          <DriversTab />
        </TabsContent>
        <TabsContent value="vehicles">
          <VehiclesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DriversTab() {
  const { data, isLoading } = useDrivers()
  const update = useUpdateDriver()
  return (
    <div className="flex flex-col h-[calc(100vh-230px)] gap-4 animate-fadeIn mt-4">
      <div className="flex justify-end">
        <CreateDriverDialog />
      </div>
      <div className="bg-card rounded-[24px] p-6 border border-border flex flex-col flex-1 min-h-[400px]">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr] text-xs font-medium text-muted-foreground pb-4 border-b border-border/50 gap-4">
          <div>Name</div>
          <div>Mobile</div>
          <div>Availability</div>
          <div className="text-right">Action</div>
        </div>
        {/* Table List */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center pt-10">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : data?.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm pt-10">
              No drivers found.
            </div>
          ) : (
            data?.map((d) => (
              <div 
                key={d.driver_id} 
                className="grid grid-cols-[2fr_2fr_1fr_1fr] items-center text-sm py-4 border-b border-border/50 hover:bg-[#202020] transition-colors px-2 -mx-2 rounded-lg gap-4"
              >
                <div className="font-semibold text-foreground truncate">{d.driver_name}</div>
                <div className="text-muted-foreground">{d.mobile}</div>
                <div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[11px] font-bold inline-flex items-center justify-center",
                    d.is_available ? "bg-[#33ff33] text-black" : "bg-[#e2e2e2] text-black"
                  )}>
                    {d.is_available ? 'Available' : 'Busy'}
                  </span>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="bg-[#202020] hover:bg-[#2a2a2a] text-foreground rounded-full transition-colors"
                    onClick={() =>
                      update.mutate({ id: d.driver_id!, body: { is_available: !d.is_available } })
                    }
                  >
                    Toggle
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function VehiclesTab() {
  const { data, isLoading } = useVehicleList()
  return (
    <div className="flex flex-col h-[calc(100vh-230px)] gap-4 animate-fadeIn mt-4">
      <div className="flex justify-end">
        <CreateVehicleDialog />
      </div>
      <div className="bg-card rounded-[24px] p-6 border border-border flex flex-col flex-1 min-h-[400px]">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr] text-xs font-medium text-muted-foreground pb-4 border-b border-border/50 gap-4">
          <div>Number</div>
          <div>Type</div>
          <div className="text-right">Capacity</div>
        </div>
        {/* Table List */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center pt-10">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : data?.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm pt-10">
              No vehicles found.
            </div>
          ) : (
            data?.map((v) => (
              <div 
                key={v.vehicle_id} 
                className="grid grid-cols-[2fr_1fr_1fr] items-center text-sm py-4 border-b border-border/50 hover:bg-[#202020] transition-colors px-2 -mx-2 rounded-lg gap-4"
              >
                <div className="font-semibold text-foreground">{v.vehicle_number}</div>
                <div className="text-muted-foreground">{v.vehicle_type}</div>
                <div className="text-right font-medium">{v.capacity ?? '—'}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function CreateDriverDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ driver_name: '', mobile: '', email: '', password: '' })
  const [meta, setMeta] = useState<Record<string, string>>({})
  const create = useCreateDriver()
  async function submit() {
    const other_info = buildMetadata(DRIVER_SPEC, meta)
    await create.mutateAsync({
      driver_name: form.driver_name,
      mobile: form.mobile,
      email: form.email || undefined,
      password: form.password || undefined,
      other_info: Object.keys(other_info).length ? other_info : undefined,
    })
    setOpen(false)
    setForm({ driver_name: '', mobile: '', email: '', password: '' })
    setMeta({})
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Register driver</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Register driver</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Name" value={form.driver_name} onChange={(v) => setForm({ ...form, driver_name: v })} />
          <Field label="Mobile" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          <MetadataFields
            spec={DRIVER_SPEC}
            values={meta}
            onChange={(k, v) => setMeta((m) => ({ ...m, [k]: v }))}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!form.driver_name || !form.mobile || create.isPending}>
            Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateVehicleDialog() {
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState('')
  const [type, setType] = useState('3W')
  const [capacity, setCapacity] = useState('')
  const [meta, setMeta] = useState<Record<string, string>>({})
  const create = useCreateVehicle()
  async function submit() {
    // Vehicle metadata lives in `other_details` (not other_info).
    const other_details = buildMetadata(VEHICLE_SPEC, meta)
    await create.mutateAsync({
      vehicle_number: number,
      vehicle_type: type as Vehicle['vehicle_type'],
      capacity: capacity ? Number(capacity) : undefined,
      other_details: Object.keys(other_details).length ? other_details : undefined,
    })
    setOpen(false)
    setNumber('')
    setCapacity('')
    setMeta({})
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Register vehicle</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Register vehicle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Vehicle number" value={number} onChange={setNumber} />
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2W">2W</SelectItem>
                <SelectItem value="3W">3W</SelectItem>
                <SelectItem value="5W">5W</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Capacity" type="number" value={capacity} onChange={setCapacity} />
          <MetadataFields
            spec={VEHICLE_SPEC}
            values={meta}
            onChange={(k, v) => setMeta((m) => ({ ...m, [k]: v }))}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!number || create.isPending}>
            Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

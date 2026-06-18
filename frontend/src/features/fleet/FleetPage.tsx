import { useState } from 'react'
import {
  useDrivers,
  useVehicleList,
  useCreateDriver,
  useUpdateDriver,
  useCreateVehicle,
} from '@/api/fleet'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Vehicle } from '@/types/models'

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
    <div className="space-y-3">
      <div className="flex justify-end">
        <CreateDriverDialog />
      </div>
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            )}
            {data?.map((d) => (
              <TableRow key={d.driver_id}>
                <TableCell className="font-medium">{d.driver_name}</TableCell>
                <TableCell>{d.mobile}</TableCell>
                <TableCell>
                  <Badge variant={d.is_available ? 'outline' : 'secondary'}>
                    {d.is_available ? 'Available' : 'Busy'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      update.mutate({ id: d.driver_id!, body: { is_available: !d.is_available } })
                    }
                  >
                    Toggle availability
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

function VehiclesTab() {
  const { data, isLoading } = useVehicleList()
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CreateVehicleDialog />
      </div>
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Capacity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            )}
            {data?.map((v) => (
              <TableRow key={v.vehicle_id}>
                <TableCell className="font-medium">{v.vehicle_number}</TableCell>
                <TableCell>{v.vehicle_type}</TableCell>
                <TableCell className="text-right tabular-nums">{v.capacity ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

function CreateDriverDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ driver_name: '', mobile: '', email: '', password: '' })
  const create = useCreateDriver()
  async function submit() {
    await create.mutateAsync({
      driver_name: form.driver_name,
      mobile: form.mobile,
      email: form.email || undefined,
      password: form.password || undefined,
    })
    setOpen(false)
    setForm({ driver_name: '', mobile: '', email: '', password: '' })
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Register driver</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register driver</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Name" value={form.driver_name} onChange={(v) => setForm({ ...form, driver_name: v })} />
          <Field label="Mobile" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
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
  const create = useCreateVehicle()
  async function submit() {
    await create.mutateAsync({
      vehicle_number: number,
      vehicle_type: type as Vehicle['vehicle_type'],
      capacity: capacity ? Number(capacity) : undefined,
    })
    setOpen(false)
    setNumber('')
    setCapacity('')
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Register vehicle</Button>
      </DialogTrigger>
      <DialogContent>
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

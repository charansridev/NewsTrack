import { useState } from 'react'
import {
  useOrganizations,
  useCreateOrganization,
  useOrgPerformance,
} from '@/api/references'
import { ORG_TYPES } from '@/lib/enums'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
import { MetadataFields } from '@/components/MetadataFields'
import { metadataSpec, buildMetadata } from '@/lib/metadataSchemas'
import type { OrgType } from '@/types/models'

const ALL = '__all__'

export default function OrganizationsPage() {
  const [type, setType] = useState<OrgType | undefined>(undefined)
  const { data, isLoading } = useOrganizations(type ? { type } : undefined)
  const [perfOrg, setPerfOrg] = useState<string | undefined>(undefined)

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Presses, hubs, distribution units, and vendors."
        actions={<CreateOrgDialog />}
      />
      <div className="mb-4">
        <Select
          value={type ?? ALL}
          onValueChange={(v) => setType(v === ALL ? undefined : (v as OrgType))}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {ORG_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Performance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            )}
            {data?.data?.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell>{o.type}</TableCell>
                <TableCell className="text-muted-foreground">{o.email ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={o.is_active === false ? 'secondary' : 'outline'}>
                    {o.is_active === false ? 'Inactive' : 'Active'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setPerfOrg(o.id)}>
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <PerformanceDialog orgId={perfOrg} onClose={() => setPerfOrg(undefined)} />
    </div>
  )
}

function PerformanceDialog({ orgId, onClose }: { orgId?: string; onClose: () => void }) {
  const { data, isLoading } = useOrgPerformance(orgId)
  return (
    <Dialog open={Boolean(orgId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Organization performance</DialogTitle>
        </DialogHeader>
        {isLoading && <Skeleton className="h-24 w-full" />}
        {data && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Metric label="Delivery success" value={`${data.delivery_success_rate?.toFixed(2)}%`} />
            <Metric label="Avg confirmation" value={`${data.avg_confirmation_minutes?.toFixed(1)} min`} />
            <Metric label="Missed deliveries" value={data.missed_deliveries} />
            <Metric label="Issues raised" value={data.issues_raised} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function CreateOrgDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<OrgType>('Vendor')
  const [email, setEmail] = useState('')
  const [meta, setMeta] = useState<Record<string, string>>({})
  const create = useCreateOrganization()
  const spec = metadataSpec('organization', type)
  async function submit() {
    const other_info = buildMetadata(spec, meta)
    await create.mutateAsync({
      name,
      type,
      email: email || undefined,
      other_info: Object.keys(other_info).length ? other_info : undefined,
    })
    setOpen(false)
    setName('')
    setEmail('')
    setMeta({})
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New organization</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Register organization</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as OrgType)
                setMeta({}) // allowed keys differ per type
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <MetadataFields
            spec={spec}
            values={meta}
            onChange={(k, v) => setMeta((m) => ({ ...m, [k]: v }))}
            title={`${type} metadata`}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name || create.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

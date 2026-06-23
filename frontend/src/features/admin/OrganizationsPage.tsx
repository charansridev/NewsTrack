import { useState } from 'react'
import { ArrowUpRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
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

import { MetadataFields } from '@/components/MetadataFields'
import { metadataSpec, buildMetadata } from '@/lib/metadataSchemas'
import type { OrgType } from '@/types/models'

const ALL = '__all__'

export default function OrganizationsPage() {
  const [type, setType] = useState<OrgType | undefined>(undefined)
  const { data, isLoading } = useOrganizations(type ? { type } : undefined)
  const [perfOrg, setPerfOrg] = useState<string | undefined>(undefined)

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-4">
      <PageHeader
        title="Organizations"
        description="Presses, hubs, distribution units, and vendors."
        actions={<CreateOrgDialog />}
      />

      <div className="flex items-center gap-3 mb-2 overflow-x-auto pb-2 scrollbar-hide">
        {[{ id: ALL, label: 'All types' }, ...ORG_TYPES.map(t => ({ id: t, label: t }))].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setType(tab.id === ALL ? undefined : (tab.id as OrgType))}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border",
              (type === tab.id || (tab.id === ALL && !type))
                ? "bg-primary text-black border-primary" 
                : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-[24px] p-6 border border-border flex flex-col flex-1 min-h-0">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr] text-xs font-medium text-muted-foreground pb-4 border-b border-border/50">
          <div>Name</div>
          <div>Type</div>
          <div>Email</div>
          <div>Status</div>
          <div className="text-right pr-4">Performance</div>
        </div>

        {/* Table List */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center pt-10">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : data?.data?.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm pt-10">
              No organizations found.
            </div>
          ) : (
            data?.data?.map((o) => (
              <div 
                key={o.id} 
                className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr] items-center text-sm py-4 border-b border-border/50 hover:bg-[#202020] transition-colors px-2 -mx-2 rounded-lg"
              >
                <div className="font-semibold text-foreground truncate pr-4" title={o.name}>{o.name}</div>
                <div className="text-muted-foreground">{o.type}</div>
                <div className="text-muted-foreground truncate pr-4">{o.email ?? '—'}</div>
                <div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[11px] font-bold inline-flex items-center justify-center",
                    o.is_active !== false
                      ? "bg-primary text-black" 
                      : "bg-[#e2e2e2] text-black"
                  )}>
                    {o.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={() => setPerfOrg(o.id)}
                    className="flex items-center gap-2 bg-[#202020] px-4 py-2 rounded-full text-xs font-semibold hover:bg-[#2a2a2a] transition-colors text-foreground"
                  >
                    View <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
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

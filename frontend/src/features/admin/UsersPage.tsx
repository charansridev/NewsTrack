import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUsers, useCreateUser, useOrganizations } from '@/api/references'
import { USER_ROLES } from '@/lib/enums'
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
import type { UserRole } from '@/types/models'

const ALL = '__all__'

export default function UsersPage() {
  const [role, setRole] = useState<UserRole | undefined>(undefined)
  const { data, isLoading } = useUsers(role ? { role } : undefined)

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-4 animate-fadeIn">
      <PageHeader
        title="Users"
        description="Platform accounts across the four roles."
        actions={<CreateUserDialog />}
      />

      <div className="flex items-center gap-3 mb-2 overflow-x-auto pb-2 scrollbar-hide">
        {[{ id: ALL, label: 'All roles' }, ...USER_ROLES.map(r => ({ id: r, label: r.replace(/([A-Z])/g, ' $1').trim() }))].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setRole(tab.id === ALL ? undefined : (tab.id as UserRole))}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border",
              (role === tab.id || (tab.id === ALL && !role))
                ? "bg-primary text-black border-primary" 
                : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-[24px] p-6 border border-border flex flex-col flex-1 min-h-[400px]">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr] text-xs font-medium text-muted-foreground pb-4 border-b border-border/50 gap-4">
          <div>Name</div>
          <div>Email</div>
          <div>Role</div>
          <div>Status</div>
        </div>

        {/* Table List */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center pt-10">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : data?.data?.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm pt-10">
              No users found.
            </div>
          ) : (
            data?.data?.map((u) => (
              <div 
                key={u.id} 
                className="grid grid-cols-[2fr_2fr_1fr_1fr] items-center text-sm py-4 border-b border-border/50 hover:bg-[#202020] transition-colors px-2 -mx-2 rounded-lg gap-4"
              >
                <div className="font-semibold text-foreground truncate pr-4">{u.name}</div>
                <div className="text-muted-foreground truncate pr-4">{u.email}</div>
                <div className="text-muted-foreground">{u.role?.replace(/([A-Z])/g, ' $1').trim()}</div>
                <div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[11px] font-bold inline-flex items-center justify-center",
                    u.is_active !== false
                      ? "bg-primary text-black" 
                      : "bg-[#e2e2e2] text-black"
                  )}>
                    {u.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const { data: orgs } = useOrganizations()
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'HubOperator' as UserRole,
    organization_id: '',
    password: '',
  })
  const [meta, setMeta] = useState<Record<string, string>>({})
  const create = useCreateUser()
  const spec = metadataSpec('user', form.role)

  async function submit() {
    const other_info = buildMetadata(spec, meta)
    await create.mutateAsync({
      name: form.name,
      email: form.email,
      role: form.role,
      organization_id: form.organization_id,
      password: form.password || undefined,
      other_info: Object.keys(other_info).length ? other_info : undefined,
    })
    setOpen(false)
    setMeta({})
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New user</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={form.role}
              onValueChange={(v) => {
                setForm({ ...form, role: v as UserRole })
                setMeta({}) // allowed keys differ per role
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Organization</Label>
            <Select
              value={form.organization_id}
              onValueChange={(v) => setForm({ ...form, organization_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {orgs?.data?.map((o) => (
                  <SelectItem key={o.id} value={o.id!}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <MetadataFields
            spec={spec}
            values={meta}
            onChange={(k, v) => setMeta((m) => ({ ...m, [k]: v }))}
            title={`${form.role} metadata`}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!form.name || !form.email || !form.organization_id || create.isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

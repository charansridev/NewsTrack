/**
 * Picks an actor (organization or user) and emits its `universal_id` — the
 * preferred actor reference on write per the API contract.
 */
import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useOrganizations, useUsers } from '@/api/references'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

interface Option {
  universalId: string
  label: string
  kind: 'ORG' | 'USER'
}

export function ActorPicker({
  value,
  onChange,
  placeholder = 'Select actor',
  includeUsers = true,
  disabled,
}: {
  value?: string
  onChange: (universalId: string) => void
  placeholder?: string
  includeUsers?: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const { data: orgs } = useOrganizations()
  const { data: users } = useUsers()

  const options = useMemo<Option[]>(() => {
    const o: Option[] = (orgs?.data ?? [])
      .filter((x) => x.universal_id)
      .map((x) => ({ universalId: x.universal_id!, label: `${x.name} · ${x.type}`, kind: 'ORG' }))
    const u: Option[] = includeUsers
      ? (users?.data ?? [])
          .filter((x) => x.universal_id)
          .map((x) => ({ universalId: x.universal_id!, label: `${x.name} (${x.role})`, kind: 'USER' }))
      : []
    return [...o, ...u]
  }, [orgs, users, includeUsers])

  const selected = options.find((o) => o.universalId === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={disabled}>
          {selected ? selected.label : <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.universalId}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.universalId)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn('size-4', value === o.universalId ? 'opacity-100' : 'opacity-0')}
                  />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

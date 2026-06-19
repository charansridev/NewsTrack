/**
 * Renders inputs for an entity's `other_info` / `other_details` allowlist.
 * Only declared keys are shown, so the form can never submit a key the backend
 * would reject with 400.
 */
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MetadataField } from '@/lib/metadataSchemas'

function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function MetadataFields({
  spec,
  values,
  onChange,
  title = 'Additional details',
}: {
  spec: MetadataField[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  title?: string
}) {
  if (spec.length === 0) return null
  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {spec.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label className="text-xs">
              {humanize(field.key)}
              {field.type === 'list' && <span className="text-muted-foreground"> (comma-sep)</span>}
            </Label>
            {field.type === 'bool' ? (
              <Select
                value={values[field.key] ?? ''}
                onValueChange={(v) => onChange(field.key, v)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="h-8"
                type={field.type === 'int' ? 'number' : 'text'}
                value={values[field.key] ?? ''}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

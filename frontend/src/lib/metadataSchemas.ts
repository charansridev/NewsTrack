/**
 * Mirror of the backend `other_info` / `other_details` allowlist
 * (backend/app/metadata_schemas.py `SPECS`).
 *
 * The backend rejects unknown keys and wrong types with 400, so forms must only
 * submit declared keys for the row's discriminator. Keep this in sync with the
 * backend registry — it is the single source of truth.
 */

export type FieldType = 'int' | 'str' | 'bool' | 'list'

export interface MetadataField {
  key: string
  type: FieldType
  required?: boolean
}

export type Entity = 'organization' | 'user' | 'vehicle' | 'driver' | 'product'

const DEFAULT = '_default'

const SPECS: Record<Entity, Record<string, MetadataField[]>> = {
  organization: {
    Press: [
      { key: 'printing_capacity', type: 'int' },
      { key: 'machine_count', type: 'int' },
      { key: 'daily_editions', type: 'int' },
    ],
    Hub: [
      { key: 'capacity', type: 'int' },
      { key: 'city', type: 'str' },
      { key: 'storage_sections', type: 'int' },
    ],
    Vendor: [
      { key: 'coverage_area', type: 'str' },
      { key: 'subscriber_count', type: 'int' },
      { key: 'delivery_routes', type: 'int' },
    ],
    DistributionUnit: [
      { key: 'service_area', type: 'str' },
      { key: 'active_agents', type: 'int' },
    ],
  },
  user: {
    Administrator: [
      { key: 'access_level', type: 'str' },
      { key: 'last_security_training', type: 'str' },
    ],
    DistributionManager: [
      { key: 'department', type: 'str' },
      { key: 'shift', type: 'str' },
      { key: 'managed_hubs', type: 'list' },
    ],
    HubOperator: [
      { key: 'hub_code', type: 'str' },
      { key: 'shift', type: 'str' },
      { key: 'employee_code', type: 'str' },
    ],
    Vendor: [
      { key: 'coverage_area', type: 'str' },
      { key: 'subscription_count', type: 'int' },
      { key: 'assigned_route', type: 'str' },
    ],
  },
  vehicle: {
    [DEFAULT]: [
      { key: 'fuel_type', type: 'str' },
      { key: 'insurance_expiry', type: 'str' },
      { key: 'service_due', type: 'str' },
      { key: 'helmet_count', type: 'int' },
      { key: 'load_category', type: 'str' },
      { key: 'gps_enabled', type: 'bool' },
    ],
  },
  driver: {
    [DEFAULT]: [
      { key: 'license_number', type: 'str' },
      { key: 'joining_date', type: 'str' },
      { key: 'experience_years', type: 'int' },
      { key: 'contract_expiry', type: 'str' },
      { key: 'vendor_company', type: 'str' },
    ],
  },
  product: {
    [DEFAULT]: [
      { key: 'bundle_id', type: 'str' },
      { key: 'packing_staff', type: 'str' },
      { key: 'destination_hub', type: 'str' },
      { key: 'edition', type: 'str' },
      { key: 'language', type: 'str' },
      { key: 'publication_date', type: 'str' },
      { key: 'category', type: 'str' },
      { key: 'issue_number', type: 'int' },
      { key: 'valid_until', type: 'str' },
      { key: 'sponsor', type: 'str' },
      { key: 'campaign_name', type: 'str' },
    ],
  },
}

/** Resolve the field spec for an entity + discriminator (falls back to default). */
export function metadataSpec(entity: Entity, discriminator?: string | null): MetadataField[] {
  const byDisc = SPECS[entity]
  if (discriminator && byDisc[discriminator]) return byDisc[discriminator]
  return byDisc[DEFAULT] ?? []
}

/**
 * Build a clean metadata object from raw string inputs, coercing to the
 * declared type and dropping empty values. Mirrors the backend's accepted shape.
 */
export function buildMetadata(
  spec: MetadataField[],
  raw: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of spec) {
    const value = raw[field.key]
    if (value == null || value === '') continue
    switch (field.type) {
      case 'int':
        out[field.key] = Number(value)
        break
      case 'bool':
        out[field.key] = value === 'true'
        break
      case 'list':
        out[field.key] = value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        break
      default:
        out[field.key] = value
    }
  }
  return out
}

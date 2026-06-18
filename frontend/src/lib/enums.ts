/** Enum value lists + display metadata, mirrored from the API contract. */
import type {
  DeliveryStatus,
  DeliveryItemStatus,
  IssueStatus,
  UserRole,
  OrgType,
} from '@/types/models'

export const USER_ROLES: UserRole[] = [
  'Administrator',
  'DistributionManager',
  'HubOperator',
  'Vendor',
]

export const ORG_TYPES: OrgType[] = ['Press', 'Hub', 'DistributionUnit', 'Vendor']

export const DELIVERY_STATUSES: DeliveryStatus[] = [
  'Created',
  'Packed',
  'Dispatched',
  'OutForDelivery',
  'Delivered',
  'Terminated',
]

export const ISSUE_STATUSES: IssueStatus[] = [
  'Open',
  'Assigned',
  'InProgress',
  'Resolved',
  'Escalated',
]

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export const DELIVERY_STATUS_VARIANT: Record<DeliveryStatus, BadgeVariant> = {
  Created: 'secondary',
  Packed: 'secondary',
  Dispatched: 'default',
  OutForDelivery: 'default',
  Delivered: 'outline',
  Terminated: 'destructive',
}

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  Created: 'Created',
  Packed: 'Packed',
  Dispatched: 'Dispatched',
  OutForDelivery: 'Out for delivery',
  Delivered: 'Delivered',
  Terminated: 'Terminated',
}

export const ITEM_STATUS_VARIANT: Record<DeliveryItemStatus, BadgeVariant> = {
  Pending: 'secondary',
  Confirmed: 'outline',
  Discrepancy: 'destructive',
  Missed: 'destructive',
}

export const ISSUE_STATUS_VARIANT: Record<IssueStatus, BadgeVariant> = {
  Open: 'destructive',
  Assigned: 'default',
  InProgress: 'default',
  Resolved: 'outline',
  Escalated: 'destructive',
}

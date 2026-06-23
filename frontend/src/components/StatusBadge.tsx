import { Badge } from '@/components/ui/badge'
import {
  DELIVERY_STATUS_VARIANT,
  DELIVERY_STATUS_LABEL,
  ALLOCATION_STATUS_VARIANT,
  ISSUE_STATUS_VARIANT,
} from '@/lib/enums'
import type { DeliveryStatus, AllocationStatus, IssueStatus } from '@/types/models'

export function DeliveryStatusBadge({ status }: { status?: DeliveryStatus }) {
  if (!status) return null
  return <Badge variant={DELIVERY_STATUS_VARIANT[status]}>{DELIVERY_STATUS_LABEL[status]}</Badge>
}

export function AllocationStatusBadge({ status }: { status?: AllocationStatus }) {
  if (!status) return null
  return <Badge variant={ALLOCATION_STATUS_VARIANT[status]}>{status}</Badge>
}

export function IssueStatusBadge({ status }: { status?: IssueStatus }) {
  if (!status) return null
  return <Badge variant={ISSUE_STATUS_VARIANT[status]}>{status}</Badge>
}

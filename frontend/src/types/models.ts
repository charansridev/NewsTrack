/** Convenience aliases over the generated OpenAPI component schemas. */
import type { components } from './api'

type S = components['schemas']

export type ApiError = S['Error']
export type Pagination = S['Pagination']
export type ActorRef = S['ActorRef']
export type ActorInput = S['ActorInput']
export type EntityType = S['EntityType']
export type UserRole = S['UserRole']
export type OrgType = S['OrgType']
export type DeliveryType = S['DeliveryType']
export type DeliveryStatus = S['DeliveryStatus']
export type DeliveryItemStatus = S['DeliveryItemStatus']
export type IssueStatus = S['IssueStatus']
export type AccessLevel = S['AccessLevel']

export type Address = S['Address']
export type Organization = S['Organization']
export type User = S['User']
export type Product = S['Product']
export type DeliveryItem = S['DeliveryItem']
export type Delivery = S['Delivery']
export type Driver = S['Driver']
export type Vehicle = S['Vehicle']
export type DeliveryAssignmentLog = S['DeliveryAssignmentLog']
export type DeliveryLog = S['DeliveryLog']
export type Issue = S['Issue']
export type IssueLog = S['IssueLog']
export type Notification = S['Notification']
export type DeliveryAccess = S['DeliveryAccess']

/** Standard paginated envelope: `{ data, pagination }`. */
export interface Paged<T> {
  data: T[]
  pagination?: Pagination
}

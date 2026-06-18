Newspaper Distribution Tracking System

# 1. Users
## Purpose
Represents all system users who can access the platform.

Examples:

```
Administrator Distribution ManagerHub Operator Vendor
```
A user always belongs to an organization.

---

## Fields
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Unique user identifier |
| universal_id | FK | Reference to Universal ID entity |
| organization_id | FK | Organization to which user belongs |
| name | String | Full name |
| email | String | Email address |
| mobile | String | Contact number |
| role | Enum | User role |
| other_info | JSONB | Organization-specific user data (see at EOD) |
| is_active | Boolean | Whether user account is active |
| address_id | FK | User address |
---

## Relationships
```
User ├── belongs to Organization ├── has one Address ├── can create Deliveries ├── can create Issues ├── can receive Notifications └── can be assigned Issues
```
---

## Business Rules
### User must belong to one organization
```
User -> Organization
```
Required relationship.

---

### User role controls permissions
Example:

```
Admin Manager Vendor
```
Role is enforced at API level.

---

### Soft Disable
Instead of deleting users:

```
is_active = false
```
User can no longer log in.

---

## Example other_info
Vendor

# 2. Organization
## Purpose
Represents operational entities participating in the distribution network.

Examples:

```
Press Hub Distribution Unit
```
Organizations may have parent-child relationships.

---

## Fields
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Organization identifier |
| universal_id | FK | Reference to Universal ID |
| parent_id | FK Nullable | Parent organization |
| name | String | Organization name |
| type | Enum | Organization type |
| email | String | Contact email |
| phone | String | Contact number |
| other_info | JSONB | Organization-specific data |
| address_id | FK | Organization address |
---



---

## Relationships
```
Organization ├── has many Users ├── has one Address ├── can send Deliveries ├── can receive Deliveries └── may have child Organizations
```
---

## Business Rules
### Parent Organization Optional
Example:

```
National Distribution    ├── Hyderabad Hub    ├── Chennai Hub    └── Bangalore Hub
```
Uses:

```
parent_id
```
---

### Organization Deletion
Organizations should never be physically deleted if:

```
Deliveries existIssues existUsers exist
```
Deactivate instead.

---

## Example other_info
Hub:

```
{  "capacity": 100000,  "city": "Hyderabad"}
```
---

# 3. Address
## Purpose
Stores reusable address information.

Used by:

```
Users Organizations
```
Delivery records use address snapshots instead.

---

## Fields
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Address identifier |
| address | Text | Complete formatted address |
---

## Relationships
```
Address ├── used by Users └── used by Organizations
```
---

## Business Rules
### Historical Deliveries Must Not Depend On Address
Delivery table stores:

```
sender_address_snapshotrecipient_address_snapshot
```
instead of address ids.

Reason:

```
Organization changes address later
```
Historical deliveries remain unchanged.

---

### Address Reuse
Same address record may be shared by:

```
OrganizationUsers
```
when appropriate.



---

# 4. Driver Details
## Purpose
Represents delivery personnel responsible for transporting products between organizations.

Drivers can be assigned to deliveries and vehicles. Assignment history is maintained through the Delivery Assignments Log.

---

## Fields
| Field | Type | Description |
| ----- | ----- | ----- |
| driver_id | UUID | Unique driver identifier |
| driver_name | String | Driver full name |
| mobile | String | Contact number |
| email | String | Email address |
| address | String | Residential address |
| other_info | JNOB | specific_data |
| is_available | Boolean | Indicates whether driver is available for assignment |
---

## Relationships
Driver
├── can be assigned to many Deliveries
├── can operate many Vehicles over time
└── participates in Delivery Assignment Logs

---

## Business Rules
### Availability
A driver can only be assigned to a delivery when:

- is_available = true
### Assignment History
Driver assignments must never be overwritten without logging.

All assignment changes must create a corresponding Delivery Assignment Log record.

### Driver Replacement
If a delivery encounters an issue:

- A new driver may be assigned.
- Assignment changes are recorded in Delivery Assignment Logs.
- Delivery continues using the updated assignment.
---

## Example
Driver:

- Name: Ravi Kumar
- Mobile: 9876543210
Assigned Deliveries:

- D101
- D102
Assignment History:

- D101 → Ravi
- D101 → Kumar (Replacement)


---

# 5. Vehicle Details
## Purpose
Represents transportation assets used for deliveries.

Vehicles are assigned to deliveries and may be reassigned when operational issues occur.

---

## Fields
| Field | Type | Description |
| ----- | ----- | ----- |
| vehicle_id | UUID | Unique vehicle identifier |
| vehicle_number | String | Registration number |
| vehicle_type | Enum | Vehicle category (2W, 3W, 5W, etc.) |
| capacity | Integer | Maximum carrying capacity |
| current_driver | FK Nullable | Current assigned driver |
| other_details | JSONB | Vehicle-specific metadata |
---

## Relationships
Vehicle
├── can be assigned to many Deliveries
├── can be operated by many Drivers over time
└── participates in Delivery Assignment Logs

---

## Business Rules
### Current Driver
current_driver represents the latest active driver assignment.

When no driver is assigned:

current_driver = NULL

### Assignment History
Historical assignments are not stored in this table.

Historical data is maintained through Delivery Assignment Logs.

### Vehicle Replacement
If a vehicle becomes unavailable:

- Another vehicle may be assigned.
- Existing delivery remains active.
- Assignment change is recorded in Delivery Assignment Logs.
---

## Example other_info
{
"fuel_type": "Diesel"
"insurance_expiry": "2027-05-01"
"service_due": "2026-08-15"
}



---

# 6. Delivery Assignments Log
## Purpose
Maintains the complete history of driver and vehicle assignments for deliveries.

This table acts as an audit trail and allows tracking of all assignment changes during a delivery lifecycle.

---

## Fields
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Unique log identifier |
| action | Enum | Assignment-related action |
| entity_type | String | Type of entity involved |
| timestamp | DateTime | Time of action |
| driver_id | FK Nullable | Driver involved |
| vehicle_id | FK Nullable | Vehicle involved |
| delivery_id | FK | Related delivery |
---

## Typical Actions
- DRIVER_ASSIGNED
- DRIVER_CHANGED
- DRIVER_REMOVED
- VEHICLE_ASSIGNED
- VEHICLE_CHANGED
- VEHICLE_REMOVED
---

## Relationships
Delivery Assignment Log
├── belongs to Delivery
├── may reference Driver
└── may reference Vehicle

---

## Business Rules
### Immutable History
Records must never be updated or deleted.

Once created, log entries remain permanent.

### Assignment Tracking
Every driver or vehicle assignment change must generate a log entry.

### Delivery Audit Trail
Assignment logs are used to reconstruct:

- Driver history of a delivery
- Vehicle history of a delivery
- Resource changes caused by issues
- Operational analytics
---

## Example Timeline
Delivery D101

05:00 AM
DRIVER_ASSIGNED
Driver: Ravi

05:00 AM
VEHICLE_ASSIGNED
Vehicle: TS09AB1234

06:30 AM
VEHICLE_CHANGED
Vehicle: TS09AB5678

07:00 AM
DRIVER_CHANGED
Driver: Kumar

08:15 AM
Delivery Completed

This timeline provides a complete record of operational changes during the delivery lifecycle.



---

# 7. Products
## Purpose
Represents distributable products within the system.

In NewsTrack, a product typically represents a newspaper edition or publication batch for a specific date.

Examples:

- The Hindu - Morning Edition - 18 Jun 2026
- Eenadu - Hyderabad Edition - 18 Jun 2026
- Sunday Special Supplement
---

## Fields
| Field | Type | Description |
| ----- | ----- | ----- |
| product_id | UUID | Unique product identifier |
| organization_id | FK | Owning organization. **Server-derived** from the creator's organization at creation time; never client-supplied. |
| created_by | FK | Universal ID of the creator (USER or ORG actor reference) |
| created_at | DateTime | Product creation timestamp (server-set) |
| name | String | Product name |
| stocks | Integer | Current available stock |
| other_info | JSONB | Product-specific metadata |
| short_description | String | Short product summary |
| description | Text | Detailed description |
---

## Relationships
Product
├── can appear in many Delivery Items
├── belongs to an Organization
└── participates in delivery chains

---

## Business Rules
### Product Identity
A product should represent a specific edition or batch.

Good:

- The Hindu - Morning Edition - 18 Jun 2026
Bad:

- The Hindu
### Creation Authority (production guard)
A product may only be created by:

- a user whose `role == Administrator`, **or**
- a user whose organization is of `type == Press` (optionally also `Hub`, via the
  `allow_hub_product_creation` toggle — default OFF).

All other callers (DistributionManager, Vendor, HubOperator without the allowance,
and any driver) are rejected with `403`. The owning `organization_id`, `created_by`,
and `created_at` are derived server-side from the authenticated caller, so a product
cannot be forged as belonging to another organization.

### Stock Management
Stock is set at creation (the production entry) and reduced when products are
dispatched: a delivery reaching `Dispatched` decrements each item's product stock by
its `expected_quantity` (clamped at 0; no auto-restock on later termination).

Direct edits to `stocks` via `PATCH /products/{id}` are restricted: only an
`Administrator` or a member of the product's owning Press org may change `stocks`;
any other caller attempting a stock change receives `403`.

### Extensibility
Additional product attributes should be stored in other_info.

---

## Example other_info
{
"edition": "Morning",
"language": "English",
"publication_date": "2026-06-18",
"category": "Daily Newspaper"
}



---

# 8. Delivery
## Purpose
Represents a single movement of products between two entities.

A delivery always exists between exactly two nodes.

Examples:

- Press → Hub
- Hub → Vendor
- Vendor → Distribution Unit
---

## Fields
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Delivery identifier |
| parent_delivery_id | FK Nullable | Parent delivery in chain |
| type | Enum | Delivery or Handend |
| sender_id | FK | Source entity |
| recipient_id | FK | Destination entity |
| driver_id | FK Nullable | Assigned driver |
| vehicle_id | FK Nullable | Assigned vehicle |
| status | Enum | Current delivery state |
| is_active | Boolean | Whether delivery is active |
| created_by | FK | Creator |
| created_at | DateTime | Creation timestamp |
| sender_address_snapshot | Text | Sender address at creation time |
| recipient_address_snapshot | Text | Recipient address at creation time |
| sender_address_id | UUID | nullable |
| recipient_address_id | UUID | nullable |
| planned_duration | Integer | Expected duration |
| confirmed_by | FK Nullable | User confirming delivery |
| confirmed_at | DateTime Nullable | Confirmation timestamp |
| photo_url | String Nullable | Proof-of-delivery image |
| has_issue | Boolean | Indicates unresolved issues exist |
| issue_count | Integer | Total issues raised |
| note | Text | Additional notes |
---

## Relationships
Delivery
├── has many Delivery Items
├── has many Issues
├── has many Notifications
├── has many Delivery Logs
├── has many Assignment Logs
├── belongs to Sender
├── belongs to Recipient
├── belongs to Driver
└── belongs to Vehicle

---

## Delivery Status Flow
Created
↓
Packed
↓
Dispatched
↓
OutForDelivery
↓
Delivered

OR

Terminated

---

## Business Rules
### One Delivery = One Movement
A delivery represents movement between exactly two entities.

### Parent Delivery Chain
Parent deliveries allow tracking of product movement through multiple hops.

Example:

Press → Hub
↓
Hub → Vendor
↓
Vendor → Distribution Unit

### Delivery Freeze
When status becomes:

- Delivered
- Terminated
The delivery becomes immutable.

Operational fields may no longer be modified.

### Address Snapshot
Historical deliveries must remain unchanged even if organization addresses change later.



---

# 9. Delivery Items
## Purpose
Represents products being transported within a delivery.

A delivery may contain one or more products.

---

## Fields
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Item identifier |
| product_id | FK | Product being transported |
| delivery_id | FK | Parent delivery |
| expected_quantity | Integer | Planned quantity |
| confirmed_quantity | Integer | Received quantity |
| status | Enum | Item status |
| note | Text | Additional notes |
---

## Relationships
Delivery Item
├── belongs to Delivery
└── belongs to Product

---

## Business Rules
### Quantity Tracking
Expected quantity is defined at dispatch time.

Confirmed quantity is recorded during delivery confirmation.

### Product Distribution
The same product may appear in multiple deliveries.

Example:

Press → Hub (5000)

Hub → Vendor A (2000)

Hub → Vendor B (3000)

### Item Independence
Each item is evaluated independently from the overall delivery status.



---

# 10. Issues
## Purpose
Represents operational problems, exceptions, or incidents that occur during the delivery lifecycle.

Issues are used to track, assign, investigate, and resolve delivery-related problems.

Examples:

- Vehicle Breakdown
- Driver Unavailable
- Accident
- Delivery Delay
- Damaged Product
- Wrong Delivery
---

## Fields
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Unique issue identifier |
| type | String | Issue category |
| title | String | Short issue title |
| description | Text | Detailed issue description |
| delivery_id | FK | Related delivery |
| assigned_to | FK | User responsible for resolution |
| assigned_at | DateTime | Assignment timestamp |
| status | Enum | Current issue status |
| resolution_note | Text | Resolution summary |
| created_by | FK | User who created the issue |
| created_at | DateTime | Creation timestamp |
| resolved_by | FK | User who resolved the issue |
| resolved_at | DateTime | Resolution timestamp |
---

## Relationships
Issue
├── belongs to Delivery
├── has many Issue Logs
├── has many Notifications
├── created by User
├── assigned to User
└── resolved by User

---

## Issue Lifecycle
Open
↓
Assigned
↓
In Progress
↓
Resolved

OR

Open
↓
Assigned
↓
In Progress
↓
Escalated
↓
Resolved

---

## Business Rules
### Issue Ownership
Every issue must have a single owner responsible for resolution.

### Delivery Impact
When an unresolved issue exists:

```text
delivery.has_issue = true
```
When all issues are resolved:

```text
delivery.has_issue = false
```
### Historical Tracking
Issues are never deleted.

Resolved issues remain available for reporting and auditing.

### Resolution
Every resolved issue must contain a resolution note describing the corrective action taken.

---

## Example
Issue:

- Type: Vehicle Breakdown
- Delivery: D101
Resolution:
"Replacement vehicle TS09AB5678 assigned and delivery resumed."



---

# 11. Notifications
## Purpose
Represents alerts and messages generated by the system.

Notifications keep users informed about operational events, issue updates, and delivery activities.

Examples:

- New Issue Assigned
- Issue Escalated
- Delivery Confirmed
- Delivery Delayed
- Delivery Completed
---

## Fields
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Notification identifier |
| type | String | Notification category |
| recipient_id | FK | User receiving notification |
| issue_id | FK Nullable | Related issue |
| message | Text | Notification content |
| is_read | Boolean | Read status |
| created_by | FK | Notification creator |
| created_at | DateTime | Creation timestamp |
| cleared_at | DateTime Nullable | Time notification was cleared |
---

## Relationships
Notification
├── belongs to User
├── may belong to Issue
└── may be generated by System or User

---

## Business Rules
### Read Tracking
Notifications remain unread until:

```text
is_read = true
```
### Issue Notifications
Issue status changes automatically generate notifications.

Examples:

- Issue Assigned
- Issue Escalated
- Issue Resolved
### Soft Clear
Notifications are not deleted immediately.

They may be marked as cleared for user convenience while preserving history.

---

## Example
Recipient:
Distribution Manager

Message:
"Vehicle breakdown reported for Delivery D101."

Status:
Unread

---

# 12. Issue Logs
## Purpose
Maintains the complete history of actions performed on an issue.

Issue Logs provide an audit trail of investigation, assignment, escalation, comments, and resolution activities.

---

## Fields
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Log identifier |
| issue_id | FK | Related issue |
| action | String | Action performed |
| remark | Text | Human-readable description |
| user_id | FK | User performing action |
| created_at | DateTime | Action timestamp |
---

## Relationships
Issue Log
├── belongs to Issue
└── belongs to User

---

## Typical Actions
- ISSUE_CREATED
- ASSIGNED
- REASSIGNED
- COMMENT_ADDED
- STATUS_CHANGED
- ESCALATED
- RESOLVED
---

## Business Rules
### Immutable History
Issue Logs must never be updated or deleted.

Every significant action creates a new log entry.

### Audit Trail
Issue Logs are the source of truth for:

- Assignment history
- Escalation history
- Investigation comments
- Resolution history
### Resolution Tracking
Resolving an issue must create a corresponding log entry.

Example:

```text
Action: RESOLVED
Remark: Replacement vehicle assigned and delivery resumed.
```
---

## Example Timeline
Issue #55

05:15 AM
ISSUE_CREATED
"Vehicle breakdown reported."

05:20 AM
ASSIGNED
Assigned to Operations Manager.

05:35 AM
COMMENT_ADDED
"Replacement vehicle being arranged."

05:50 AM
RESOLVED
"Replacement vehicle assigned and delivery resumed."

This timeline provides a complete record of issue handling throughout its lifecycle.



---



# Dynamic Metadata (other_info)
## Purpose
The `other_info` field stores implementation-specific attributes that are not part of the core system schema.

This allows the platform to remain generic while supporting different business domains such as newspaper distribution, courier services, food logistics, pharmaceutical distribution, and future implementations.

The structure and validation of `other_info` are defined by the application configuration based on entity type.

---

## User Metadata
### Description
Stores role-specific information that varies depending on the user's responsibilities within an organization.

### Examples
#### Vendor
```
{  "coverage_area": "North Zone",  "subscription_count": 1200,  "assigned_route": "R001"}
```
#### Distribution Manager
```
{  "department": "Operations",  "shift": "Morning",  "managed_hubs": ["H001", "H002"]}
```
#### Hub Operator
```
{  "hub_code": "HYD-HUB-01",  "shift": "Night",  "employee_code": "EMP102"}
```
#### Administrator
```
{  "access_level": "SUPER_ADMIN",  "last_security_training": "2026-01-10"}
```
---

## Organization Metadata
### Description
Stores organization-specific operational information based on organization type.

### Examples
#### Press
```
{  "printing_capacity": 500000,  "machine_count": 8,  "daily_editions": 12}
```
#### Hub
```
{  "capacity": 100000,  "city": "Hyderabad",  "storage_sections": 12}
```
#### Vendor
```
{  "coverage_area": "North Hyderabad",  "subscriber_count": 1500,  "delivery_routes": 5}
```
#### Distribution Unit
```
{  "service_area": "Secunderabad",  "active_agents": 25}
```
---

## Driver Metadata
### Description
Stores driver-specific operational and employment information.

### Examples
#### Full-Time Driver
```
{  "license_number": "TS123456",  "joining_date": "2025-01-01",  "experience_years": 5}
```
#### Contract Driver
```
{  "license_number": "TS987654",  "contract_expiry": "2027-06-30",  "vendor_company": "ABC Logistics"}
```
---

## Vehicle Metadata
### Description
Stores additional vehicle information used for operations, compliance, and maintenance tracking.

### Examples
#### Van
```
{  "fuel_type": "Diesel",  "insurance_expiry": "2027-05-01",  "service_due": "2026-08-15"}
```
#### Motorcycle
```
{  "fuel_type": "Petrol",  "helmet_count": 2,  "service_due": "2026-07-01"}
```
#### Truck
```
{  "fuel_type": "Diesel",  "load_category": "Heavy",  "gps_enabled": true}
```
---

## Product Metadata
### Description
Stores product-specific attributes that vary according to product category and business implementation.

### Examples
#### Newspaper Edition
```
{  "edition": "Morning",  "language": "English",  "publication_date": "2026-06-18"}
```
#### Weekly Magazine
```
{  "issue_number": 245,  "publication_date": "2026-06-20",  "category": "Technology"}
```
#### Promotional Insert
```
{  "campaign_name": "Summer Sale",  "valid_until": "2026-06-30",  "sponsor": "ABC Retail"}
```
---

## Business Rules
### Configuration Driven
The structure of `other_info` is defined by the implementation configuration and may vary by entity type.

### Extensible
New attributes may be added without requiring database schema changes.

### Validation
The application layer is responsible for validating metadata according to the active implementation rules.

### Core Data Separation
Business-critical fields must remain dedicated database columns.

`other_info` should only contain implementation-specific extensions and supplemental information.




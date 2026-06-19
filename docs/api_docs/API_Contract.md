# NewsTrack API Reference (v1.0)

Human-readable companion to `newstrack-openapi.yaml` (the machine-readable source of truth). Import the YAML into Swagger UI or Postman for live testing; use this doc for orientation and conventions.

- **Base URL:** `https://api.newstrack.example.com/v1`
- **Format:** JSON over HTTPS. All timestamps are ISO-8601 UTC (`2026-06-18T04:32:00Z`).
- **Auth:** Bearer JWT. Two **independent** token systems — see [Authentication](#authentication).

---

## Core modeling decisions

| PRD term | In the API |
|---|---|
| Bundle | A Product. Bundle-specific fields (bundle_id, packing_staff, destination_hub, edition, etc.) live in Product.other_info. |
| Product Inventory | Source of truth for available stock within an organization. |
| Route | Not a stored entity. A route is the derived pair (sender_address_id, recipient_address_id). |
| Delivery | One movement of inventory between exactly two nodes (Press→Hub, Hub→Vendor, etc.), chained via parent_delivery_id. |
| Manifest | The set of Inventory Allocations attached to a delivery. |
| Stages | UI labels mapped onto the canonical delivery status enum. |

---

## Authentication

Two separate JWT systems. A token from one **cannot** be used on the other's endpoints.

**1. Platform users** — `POST /auth/login` → user JWT.
Payload carries `sub` (user id), `universal_id`, `organization_id`, and `role` ∈ `Administrator | DistributionManager | HubOperator | Vendor`. Send as `Authorization: Bearer <token>`. The client stores the returned `universal_id` and uses it for actor references (below).

**2. Drivers** — `POST /driver/auth/login` (mobile + password) → driver JWT.
Payload carries `driver_id` and a `driver` claim. Used only for driver-facing endpoints (`/driver/me/deliveries`) and the shared transit/confirm actions on deliveries.

> **Role is enforced at the API, not the UI.** A Vendor calling an endpoint outside their scope receives `403` regardless of frontend state.

---

## Actor references (Universal ID)

Any "who" field — `created_by`, `sender`, `recipient`, `assigned_to`, `confirmed_by`, `resolved_by` — is polymorphic and resolves through **Universal ID** to either a `USER` or an `ORG`.

**On write**, send either form (`universal_id` is preferred — it's what the client stored at login):

```json
{ "universal_id": "9b1c...e4" }
```
```json
{ "id": "5a2f...c1", "type": "ORG" }
```

When `{ id, type }` is sent, the server resolves it to a `universal_id` **first**, then runs the access check.

**On read**, references are expanded:

```json
{
  "universal_id": "9b1c...e4",
  "entity_type": "ORG",
  "entity_id": "5a2f...c1",
  "name": "Hyderabad Hub"
}
```

Use `GET /universal-ids/resolve` to convert between a raw `{id, type}` and a `universal_id`.

---

## Delivery access model

Read/write access to a delivery is the union of:

- **Primary (implicit, not stored):** the **sender**, the **recipient**, and the **assigned driver**, each at their respective level.
- **Additional (stored in Delivery Access):** explicit grants an **Administrator** hands to any user/org via `POST /deliveries/{id}/access`, with `access_level` ∈ `READ | WRITE | CONFIRM`.

Effective check per delivery:
`is_admin OR is_sender OR is_recipient OR is_assigned_driver OR has_grant`.

`GET/POST/DELETE /deliveries/{id}/access` manage the additional grants only.

---

## Immutability rules

- A delivery with status **Delivered** or **Terminated** is **frozen** — mutating it returns `409 CONFLICT`.
- A **confirmed** delivery cannot be re-confirmed or edited (audit trail).
- **Delivery Logs**, **Assignment Logs**, and **Issue Logs** are append-only — no update/delete.

---

## Implementation notes (extensions beyond the base contract)

These reflect the running implementation:

- **`POST /auth/login`** also returns a **`refresh_token`** (use at `POST /auth/refresh`).
- **`password`** is an accepted **write-only** field on user create/update and driver
  register/update (sets the login password). It is never returned.
- **Organizations** carry an **`is_active`** flag; `DELETE` soft-disables (sets it false).
- **Issues** carry a **`deadline`** (set at assignment); issues past their deadline are
  **auto-escalated** by a background job.
- **`Notification.created_by`** is returned as a raw **`universal_id` string** (or null for
  system notifications), not an expanded `ActorRef`.
- **Deliveries** record `dispatched_at` / `delivered_at` internally (when those statuses are
  reached) as the basis for duration/on-time analytics; inventory changes are handled by
  Product Inventory and Delivery Allocation workflows.
- **Inventory transfer / delay / missed / escalation** run as periodic background jobs and also
  surface as `delivery.delay_flagged`, `issue.status_changed`, and `notification.new` events.
- **`other_info` / `other_details` are validated** on create/update against a strict
  allowlist per entity type (declared in `backend/app/metadata_schemas.py`): unknown keys
  and wrong types are rejected with `400 VALIDATION_ERROR`; empty metadata is allowed.
  See the DB doc's "Dynamic Metadata" section for the per-type discriminators and rules.

---

## Conventions

**Auth header**
```
Authorization: Bearer <jwt>
```

**List envelope**
```json
{ "data": [ ... ], "pagination": { "page": 1, "page_size": 50, "total": 327, "total_pages": 7 } }
```

**Pagination / sort:** `?page=1&page_size=50&sort=created_at:desc`
**Date filtering:** `?from=2026-06-01T00:00:00Z&to=2026-06-18T23:59:59Z`

**Error envelope**
```json
{ "error": { "code": "FORBIDDEN", "message": "You do not have access to this resource.", "details": [] } }
```

| HTTP | code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body/params invalid |
| 401 | `UNAUTHORIZED` | Missing/invalid token |
| 403 | `FORBIDDEN` | Role or delivery-access check failed |
| 404 | `NOT_FOUND` | No such resource |
| 409 | `CONFLICT` / `IMMUTABLE_RECORD` | Frozen delivery, illegal transition, re-confirm |
| 429 | `RATE_LIMITED` | Throttled |

**Numeric accuracy:** all percentage/aggregate outputs are rounded to **2 decimal places**; quantities are exact integers (no rounding).

---

## Enumerations

| Enum | Values |
|---|---|
| `UserRole` | Administrator, DistributionManager, HubOperator, Vendor |
| `OrgType` | Press, Hub, DistributionUnit, Vendor |
| `DeliveryType` | Delivery, Handend |
| `DeliveryStatus` | Created → Packed → Dispatched → OutForDelivery → Delivered · or · Terminated |
| `AllocationStatus` | Pending, Confirmed, Discrepancy, Missed |
| `IssueStatus` | Open, Assigned, InProgress, Resolved, Escalated |
| `AssignmentAction` | DRIVER_ASSIGNED, DRIVER_CHANGED, DRIVER_REMOVED, VEHICLE_ASSIGNED, VEHICLE_CHANGED, VEHICLE_REMOVED |
| `AccessLevel` | READ, WRITE, CONFIRM |
| `EntityType` | USER, ORG |

---

## Endpoint index

### Auth
| Method | Path | Summary |
|---|---|---|
| POST | `/auth/login` | User login → user JWT |
| POST | `/auth/refresh` | Refresh user token |
| GET | `/auth/me` | Current user |
| POST | `/driver/auth/login` | Driver login → driver JWT (separate system) |

### Users
| Method | Path | Summary |
|---|---|---|
| GET | `/users` | List users |
| POST | `/users` | Create user (Administrator) |
| GET | `/users/{user_id}` | Get user |
| PATCH | `/users/{user_id}` | Update user |
| DELETE | `/users/{user_id}` | Soft-disable (never hard-delete) |

### Organizations (hubs / vendors / presses / units)
| Method | Path | Summary |
|---|---|---|
| GET | `/organizations` | List (filter by `type`, `parent_id`) |
| POST | `/organizations` | Register |
| GET | `/organizations/{org_id}` | Get |
| PATCH | `/organizations/{org_id}` | Update |
| DELETE | `/organizations/{org_id}` | Deactivate (409 if deliveries/issues/users exist) |
| GET | `/organizations/{org_id}/performance` | Vendor/hub performance metrics |

### Addresses
| Method | Path | Summary |
|---|---|---|
| GET | `/addresses` | List |
| POST | `/addresses` | Create |
| GET | `/addresses/{address_id}` | Get |

### Universal ID
| Method | Path | Summary |
|---|---|---|
| GET | `/universal-ids/resolve` | Resolve `universal_id` ↔ `{id, type}` |

### Products (bundles)
| Method | Path | Summary |
|---|---|---|
| GET | `/products` | List / search |
| POST | `/products` | Create (production entry) — **Administrator or Press org only** |
| GET | `/products/{product_id}` | Get |
| PATCH | `/products/{product_id}` | Update metadata |

#### Product Creation & Inventory Rules

Products represent catalog/master records only.

A product defines:

- Name
- SKU
- Description
- Metadata

Products do not represent available stock.

Available stock is maintained through Product Inventory records.

Server-derived fields:

- organization_id
- created_by
- created_at

Products may only be created by:

- Administrator
- Press organization users

Stock operations are performed through Product Inventory and Delivery workflows.

### Product Inventory

| Method | Path | Summary |
|---|---|---|
| GET | `/inventory` | List inventory |
| GET | `/inventory/{inventory_id}` | Get inventory record |
| GET | `/inventory/organization/{org_id}` | Organization inventory |
| PATCH | `/inventory/{inventory_id}` | Update metadata |

#### Product Inventory Rules

Inventory is the authoritative source of available stock.

Each inventory record belongs to:

- Product
- Organization

Inventory records track:

- received_stock
- current_stock
- status

Inventory may only be consumed through deliveries.

Inventory may only increase through:

- Delivery receipt
- Administrative adjustment

Example:

Press Inventory
Current Stock = 10000

Dispatch = 5000

Remaining Stock = 5000

### Deliveries
| Method | Path | Summary |
|---|---|---|
| GET | `/deliveries` | List / search (access-filtered; status board + 90-day history) |
| POST | `/deliveries` | Create one inventory movement between organizations |
| GET | `/deliveries/{id}` | Get (with allocations) |
| PATCH | `/deliveries/{id}` | Update mutable fields (409 if frozen) |
| POST | `/deliveries/{id}/status` | Advance status (user **or** driver JWT) → WS event |
| POST | `/deliveries/{id}/confirm` | Confirm + quantity check + photo (immutable after) |
| POST | `/deliveries/{id}/assign` | Assign/change driver/vehicle → assignment log |
| GET | `/deliveries/{id}/manifest` | Allocation manifest |
| GET | `/deliveries/{id}/logs` | Per-delivery event log (immutable) |
| GET | `/deliveries/{id}/assignment-logs` | Driver/vehicle history (immutable) |

### Delivery Allocations

| Method | Path | Summary |
|---|---|---|
| GET | `/deliveries/{id}/allocations` | List allocations |
| POST | `/deliveries/{id}/allocations` | Add allocation |
| PATCH | `/delivery-allocations/{allocation_id}` | Update allocation |

```json
{
  "allocation_id": "alloc_001",
  "delivery_id": "del_001",
  "inventory_id": "inv_001",
  "expected_quantity": 5000,
  "confirmed_quantity": 4980,
  "status": "Discrepancy"
}
```

### Inventory Integrity

When a delivery reaches Dispatched:

- Sender inventory is validated.
- Sender inventory current_stock is reduced.

When a delivery reaches Delivered:

- Recipient inventory is created or updated.
- received_stock is increased.
- current_stock is increased.

Inventory remains the single source of truth for available stock.

Final structure:

Products
   ↓
Product Inventory
   ↓
Delivery Allocations
   ↓
Deliveries
   ↓
Inventory Transfer

### Drivers (operational data; auth separate)
| Method | Path | Summary |
|---|---|---|
| GET | `/drivers` | List (filter `is_available`) |
| POST | `/drivers` | Register |
| GET | `/drivers/{driver_id}` | Get |
| PATCH | `/drivers/{driver_id}` | Update (availability) |
| GET | `/driver/me/deliveries` | **Driver JWT** — assigned deliveries + manifest |

### Vehicles
| Method | Path | Summary |
|---|---|---|
| GET | `/vehicles` | List |
| POST | `/vehicles` | Register |
| GET | `/vehicles/{vehicle_id}` | Get |
| PATCH | `/vehicles/{vehicle_id}` | Update (incl. `current_driver`) |

### Issues
| Method | Path | Summary |
|---|---|---|
| GET | `/issues` | List / search |
| POST | `/issues` | Raise (user or driver) → sets `delivery.has_issue=true` |
| GET | `/issues/{id}` | Get |
| POST | `/issues/{id}/assign` | Assign/reassign + deadline |
| POST | `/issues/{id}/status` | Change status (resolve needs `resolution_note`) |
| GET | `/issues/{id}/logs` | Audit trail (immutable) |
| POST | `/issues/{id}/logs` | Add comment entry |

### Notifications
| Method | Path | Summary |
|---|---|---|
| GET | `/notifications` | List for current user (`unread_count` included) |
| POST | `/notifications/{id}/read` | Mark read |
| POST | `/notifications/{id}/clear` | Soft-clear (history preserved) |

### Delivery Access (additional grants)
| Method | Path | Summary |
|---|---|---|
| GET | `/deliveries/{id}/access` | List grants |
| POST | `/deliveries/{id}/access` | Grant (Administrator) |
| DELETE | `/deliveries/{id}/access` | Revoke (`?participant_id=`) |

### Routes & Analytics
| Method | Path | Summary |
|---|---|---|
| GET | `/routes/performance` | Route metrics by address pair (min/max/avg, on-time %) |
| GET | `/reports/daily-summary` | Daily KPIs |
| GET | `/reports/delivery-success` | Success rate by `route`/`vendor`/`hub` |
| GET | `/reports/export` | Export report to PDF |

---

## Worked examples

### Create a delivery (Press → Hub) with allocations
`POST /deliveries`
```json
{
  "type": "Delivery",
  "sender": {
    "universal_id": "press-uid-001"
  },
  "recipient": {
    "id": "hub-org-007",
    "type": "ORG"
  },
  "sender_address_id": "addr-press-01",
  "recipient_address_id": "addr-hub-07",
  "planned_duration": 45,
  "allocations": [
    {
      "inventory_id": "inv_press_hindu",
      "expected_quantity": 5000
    }
  ]
}
```
The server stores both address ids (for route analytics) and immutable snapshots, sets `status=Created`, and returns the expanded delivery.

### Driver pushes a transit update (drives the live board)
`POST /deliveries/{id}/status` (driver JWT)
```json
{ "status": "OutForDelivery", "remark": "Left Hyderabad hub" }
```
Writes a Delivery Log entry and emits `delivery.status_changed` over WebSocket.

### Confirm delivery with quantity check
`POST /deliveries/{id}/confirm`
```json
{
  "photo_url": "https://cdn.newstrack.example.com/pod/abc.jpg",
  "allocations": [
    {
      "allocation_id": "alloc_001",
      "confirmed_quantity": 4980
    }
  ]
}
```
A mismatch vs `expected_quantity` marks the allocation `Discrepancy` and raises an alert. After this, the record is immutable.

---

## Real-Time (WebSocket) contract

The PRD mandates driver updates reach the manager dashboard within **5 seconds**. The REST layer is authoritative; WebSocket is the push channel. (If polling is used instead, poll the relevant `GET` list endpoints at ≤5s.)

**Connect:** `wss://api.newstrack.example.com/v1/realtime?token=<jwt>` — same JWT, validated on connect.

**Subscribe** (client → server):
```json
{ "action": "subscribe", "channels": ["transit_board", "alerts"] }
```

**Server → client events:**

| Event | Payload | Trigger |
|---|---|---|
| `delivery.status_changed` | `{ delivery_id, status, driver_id, vehicle_id, at }` | Any status transition |
| `delivery.confirmed` | `{ delivery_id, confirmed_by, at, has_discrepancy }` | Confirmation |
| `delivery.assignment_changed` | `{ delivery_id, action, driver_id, vehicle_id, at }` | Driver/vehicle reassignment |
| `delivery.delay_flagged` | `{ delivery_id, vehicle_id, last_update_at, threshold_min }` | No status update within threshold |
| `issue.raised` | `{ issue_id, delivery_id, type, title, at }` | New issue |
| `issue.status_changed` | `{ issue_id, status, at }` | Issue transition / escalation |
| `notification.new` | `Notification` object | New notification for the subscribed user |

> Server-side jobs handle auto-flagging of stale vehicle statuses, missed-delivery flags after the delivery window, and issue escalation past deadline — these surface as the `*.delay_flagged`, `issue.status_changed` (Escalated), and `notification.new` events.
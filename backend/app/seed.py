"""Seed script — realistic demo data.

Creates: 1 press, >=3 hubs, >=10 vendors; one user per role + a couple of
drivers and vehicles; >=5 routes (address pairs); and 30 days of historical
deliveries with assorted statuses, confirmations, discrepancies, and a few
issues.

Run:  python -m app.seed            (writes to the configured DATABASE_URL)
      python -m app.seed --reset    (drop + recreate all tables first)
"""

import random
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.identity import create_organization, create_user
from app.core.security import hash_password
from app.database import Base, SessionLocal, engine
from app.models.address import Address
from app.models.delivery import Delivery, DeliveryItem
from app.models.driver import Driver
from app.models.enums import (
    DeliveryItemStatus,
    DeliveryStatus,
    DeliveryType,
    IssueStatus,
    OrgType,
    UserRole,
)
from app.models.issue import Issue
from app.models.logs import DeliveryLog, IssueLog
from app.models.product import Product
from app.models.vehicle import Vehicle

RNG = random.Random(20260618)  # deterministic seed


def _utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc)


def reset_schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)


def seed(db) -> dict:
    # ── Addresses ───────────────────────────────────────────────────────────
    press_addr = Address(address="Press House, Industrial Estate, Hyderabad")
    hub_addrs = [Address(address=f"Hub {i+1}, Sector {i+1}, Hyderabad") for i in range(3)]
    vendor_addrs = [Address(address=f"Vendor Stall {i+1}, Market Rd, Zone {i % 5}") for i in range(10)]
    db.add_all([press_addr, *hub_addrs, *vendor_addrs])
    db.flush()

    # ── Organizations ─────────────────────────────────────────────────────
    press = create_organization(db, name="The Hindu Press", type=OrgType.Press,
                                email="press@hindu.example", address_id=press_addr.id,
                                other_info={"printing_capacity": 500000})
    hubs = [
        create_organization(db, name=f"Hyderabad Hub {i+1}", type=OrgType.Hub,
                            email=f"hub{i+1}@nt.example", parent_id=None,
                            address_id=hub_addrs[i].id, other_info={"capacity": 100000})
        for i in range(3)
    ]
    vendors = [
        create_organization(db, name=f"Vendor {i+1}", type=OrgType.Vendor,
                           email=f"vendor{i+1}@nt.example", address_id=vendor_addrs[i].id,
                           other_info={"subscriber_count": 500 + i * 100})
        for i in range(10)
    ]

    # ── Users (one per role) + drivers + vehicles ──────────────────────────
    admin = create_user(db, organization_id=hubs[0].id, name="Asha Admin",
                       email="admin@nt.example", role=UserRole.Administrator,
                       password_hash=hash_password("admin-pass"))
    manager = create_user(db, organization_id=hubs[0].id, name="Manjit Manager",
                         email="manager@nt.example", role=UserRole.DistributionManager,
                         password_hash=hash_password("manager-pass"))
    operator = create_user(db, organization_id=hubs[1].id, name="Omar Operator",
                         email="operator@nt.example", role=UserRole.HubOperator,
                         password_hash=hash_password("operator-pass"))
    vendor_user = create_user(db, organization_id=vendors[0].id, name="Vivek Vendor",
                            email="vendor@nt.example", role=UserRole.Vendor,
                            password_hash=hash_password("vendor-pass"))
    # A user in the press org so products can be created by a Press member.
    press_user = create_user(db, organization_id=press.id, name="Priya Press",
                           email="press@nt.example", role=UserRole.HubOperator,
                           password_hash=hash_password("press-pass"))

    drivers = [
        Driver(driver_name="Ravi Kumar", mobile="9800000001", is_available=True,
               password_hash=hash_password("driver-pass"), other_info={"experience_years": 5}),
        Driver(driver_name="Sita Devi", mobile="9800000002", is_available=True,
               password_hash=hash_password("driver-pass"), other_info={"experience_years": 3}),
    ]
    vehicles = [
        Vehicle(vehicle_number="TS09AB1234", vehicle_type="3W", capacity=500),
        Vehicle(vehicle_number="TS09CD5678", vehicle_type="5W", capacity=2000),
    ]
    db.add_all([*drivers, *vehicles])
    db.flush()

    # ── Products (bundles) created by the press ────────────────────────────
    products = []
    for i in range(6):
        pub = (datetime.now(timezone.utc).date() - timedelta(days=i)).isoformat()
        products.append(Product(
            organization_id=press.id, created_by=press_user.universal_id,
            name=f"The Hindu - Morning - {pub}", stocks=100000,
            other_info={"edition": "Morning", "language": "English", "publication_date": pub},
        ))
    db.add_all(products)
    db.flush()

    # ── Routes = address pairs (press->hub, hub->vendor): >=5 ───────────────
    routes = []
    for h_addr in hub_addrs:
        routes.append((press_addr, h_addr))            # 3 press->hub routes
    for v_addr in vendor_addrs[:3]:
        routes.append((hub_addrs[0], v_addr))          # 3 hub->vendor routes
    # -> 6 distinct routes

    hub_uid = {hub_addrs[i].id: hubs[i].universal_id for i in range(3)}

    # ── 30 days of historical deliveries ───────────────────────────────────
    now = datetime.now(timezone.utc)
    deliveries = []
    for day in range(30):
        created = now - timedelta(days=day, hours=RNG.randint(0, 6))
        for (s_addr, r_addr) in routes:
            # sender/recipient universal ids
            sender_uid = press.universal_id if s_addr is press_addr else hub_uid[s_addr.id]
            if r_addr in hub_addrs:
                recipient_uid = hub_uid[r_addr.id]
            else:
                recipient_uid = RNG.choice(vendors).universal_id

            planned = RNG.choice([30, 45, 60, 90])
            # Most delivered; some terminated; recent ones still in transit.
            roll = RNG.random()
            d = Delivery(
                type=DeliveryType.Delivery, sender_id=sender_uid, recipient_id=recipient_uid,
                sender_address_id=s_addr.id, recipient_address_id=r_addr.id,
                sender_address_snapshot=s_addr.address, recipient_address_snapshot=r_addr.address,
                planned_duration=planned, created_by=manager.universal_id,
                created_at=_utc(created), driver_id=RNG.choice(drivers).driver_id,
                vehicle_id=RNG.choice(vehicles).vehicle_id, is_active=True,
            )
            if day == 0 and roll < 0.5:
                d.status = RNG.choice([DeliveryStatus.Dispatched, DeliveryStatus.OutForDelivery])
                d.dispatched_at = _utc(created + timedelta(minutes=10))
            elif roll < 0.85:
                d.status = DeliveryStatus.Delivered
                d.dispatched_at = _utc(created + timedelta(minutes=10))
                actual = planned + RNG.randint(-10, 30)  # some late, some on time
                d.delivered_at = d.dispatched_at + timedelta(minutes=max(5, actual))
                d.confirmed_by = recipient_uid
                d.confirmed_at = d.delivered_at + timedelta(minutes=RNG.randint(2, 20))
                d.is_active = False
            else:
                d.status = DeliveryStatus.Terminated
                d.dispatched_at = _utc(created + timedelta(minutes=10))
                d.is_active = False
            db.add(d)
            db.flush()

            qty = RNG.choice([1000, 2000, 5000])
            item = DeliveryItem(
                delivery_id=d.id, product_id=RNG.choice(products).product_id,
                expected_quantity=qty,
                status=DeliveryItemStatus.Pending,
            )
            if d.status == DeliveryStatus.Delivered:
                confirmed = qty if RNG.random() < 0.8 else qty - RNG.randint(10, 100)
                item.confirmed_quantity = confirmed
                item.status = (DeliveryItemStatus.Confirmed if confirmed == qty
                               else DeliveryItemStatus.Discrepancy)
            db.add(item)
            db.add(DeliveryLog(delivery_id=d.id, action=f"STATUS_{d.status.value}",
                              user_id=manager.id, timestamp=d.created_at))
            deliveries.append(d)

    # ── A handful of issues across deliveries ───────────────────────────────
    issue_types = ["Vehicle Breakdown", "Route Block", "Quantity Shortage", "Delivery Delay"]
    for _ in range(8):
        d = RNG.choice(deliveries)
        issue = Issue(
            type=RNG.choice(issue_types), title="Operational incident",
            description="Auto-seeded incident.", delivery_id=d.id,
            status=RNG.choice([IssueStatus.Open, IssueStatus.Assigned, IssueStatus.Resolved]),
            created_by=manager.universal_id, created_at=d.created_at,
        )
        if issue.status == IssueStatus.Resolved:
            issue.resolution_note = "Resolved by ops."
            issue.resolved_by = manager.universal_id
            issue.resolved_at = d.created_at + timedelta(hours=2)
        else:
            d.has_issue = True
        db.add(issue)
        db.flush()
        db.add(IssueLog(issue_id=issue.id, action="ISSUE_CREATED",
                       user_id=manager.id, created_at=issue.created_at))
        d.issue_count = (d.issue_count or 0) + 1

    db.commit()
    return {
        "press": press.id, "hubs": [h.id for h in hubs], "vendors": len(vendors),
        "routes": len(routes), "deliveries": len(deliveries),
        "drivers": [dr.driver_id for dr in drivers],
        "logins": {
            "admin@nt.example": "admin-pass", "manager@nt.example": "manager-pass",
            "operator@nt.example": "operator-pass", "vendor@nt.example": "vendor-pass",
            "press@nt.example": "press-pass",
            "driver (mobile 9800000001/2)": "driver-pass",
        },
    }


def main():
    if "--reset" in sys.argv:
        print("Resetting schema...")
        reset_schema()
    db = SessionLocal()
    try:
        # Guard against double-seeding.
        if db.execute(select(Driver).limit(1)).first() and "--reset" not in sys.argv:
            print("Data already present; pass --reset to wipe and reseed.")
            return
        summary = seed(db)
    finally:
        db.close()
    print("Seed complete:")
    for k, v in summary.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()

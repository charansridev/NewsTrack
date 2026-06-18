"""Auth dependencies and access guards.

Two independent identities flow through here:
  * platform users  (user JWT)   -> ``get_current_user``
  * drivers         (driver JWT)  -> ``get_current_driver``

``require_roles`` enforces UserRole at the API layer on every protected route.
``check_delivery_access`` implements the union access model; its sender/recipient
/driver/grant branches are wired once the Delivery model is in use (Phase 4).
"""

from dataclasses import dataclass

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.errors import Forbidden, NotFound, Unauthorized
from app.core.security import decode_driver_token, decode_user_token
from app.database import get_db
from app.models.driver import Driver
from app.models.enums import AccessLevel, OrgType, UserRole
from app.models.organization import Organization
from app.models.user import User

# auto_error=False so we can raise the contract's UNAUTHORIZED envelope ourselves.
_bearer = HTTPBearer(auto_error=False)


def _token_from(creds: HTTPAuthorizationCredentials | None) -> str:
    if creds is None or not creds.credentials:
        raise Unauthorized("Authentication required.")
    return creds.credentials


# ── Platform user identity ────────────────────────────────────────────────────
def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    token = _token_from(creds)
    try:
        payload = decode_user_token(token)
    except jwt.PyJWTError:
        raise Unauthorized("Invalid or expired token.")
    if payload.get("token_use") != "user_access":
        raise Unauthorized("Wrong token type for this endpoint.")
    user = db.get(User, payload.get("sub"))
    if user is None or not user.is_active:
        raise Unauthorized("User not found or inactive.")
    return user


def require_roles(*roles: UserRole):
    """Dependency factory enforcing that the caller holds one of ``roles``."""
    allowed = {r if isinstance(r, UserRole) else UserRole(r) for r in roles}

    def _guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise Forbidden("You do not have access to this resource.")
        return user

    return _guard


def _product_creator_org_types() -> set[OrgType]:
    """Org types whose members may create products (besides Administrators)."""
    types = {OrgType.Press}
    if settings.allow_hub_product_creation:
        types.add(OrgType.Hub)
    return types


def require_product_creator(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Guard for production endpoints (e.g. POST /products).

    Permits a caller who is an Administrator, OR whose organization is of a
    product-creating type (Press; optionally Hub via config). Everyone else
    — DistributionManager, Vendor, HubOperator outside the allowance, and any
    driver token (which never resolves as a user) — gets 403.

    Reusable across future production endpoints.
    """
    if user.role == UserRole.Administrator:
        return user
    org = db.get(Organization, user.organization_id)
    if org is not None and org.type in _product_creator_org_types():
        return user
    raise Forbidden("Only Administrators or members of a producing organization may do this.")


# ── Driver identity ─────────────────────────────────────────────────────────
def get_current_driver(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Driver:
    token = _token_from(creds)
    try:
        payload = decode_driver_token(token)
    except jwt.PyJWTError:
        raise Unauthorized("Invalid or expired token.")
    if payload.get("token_use") != "driver_access" or not payload.get("driver"):
        raise Unauthorized("Wrong token type for this endpoint.")
    driver = db.get(Driver, payload.get("driver_id"))
    if driver is None:
        raise Unauthorized("Driver not found.")
    return driver


# ── Shared identity (user OR driver) ──────────────────────────────────────────
@dataclass
class Actor:
    """A unified caller identity for endpoints that accept either token system."""

    kind: str  # "user" | "driver"
    user: User | None = None
    driver: Driver | None = None

    @property
    def universal_id(self) -> str | None:
        return self.user.universal_id if self.user else None

    @property
    def role(self) -> UserRole | None:
        return self.user.role if self.user else None

    @property
    def actor_log_id(self) -> str:
        """Id written to delivery/issue logs (user id or driver id)."""
        return self.user.id if self.user else self.driver.driver_id

    @property
    def is_admin(self) -> bool:
        return bool(self.user and self.user.role == UserRole.Administrator)


def get_current_actor(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Actor:
    """Resolve the caller as either a platform user or a driver."""
    token = _token_from(creds)
    # Try the user system first, then the driver system.
    try:
        payload = decode_user_token(token)
        if payload.get("token_use") == "user_access":
            user = db.get(User, payload.get("sub"))
            if user and user.is_active:
                return Actor(kind="user", user=user)
    except jwt.PyJWTError:
        pass
    try:
        payload = decode_driver_token(token)
        if payload.get("token_use") == "driver_access" and payload.get("driver"):
            driver = db.get(Driver, payload.get("driver_id"))
            if driver:
                return Actor(kind="driver", driver=driver)
    except jwt.PyJWTError:
        pass
    raise Unauthorized("Invalid or expired token.")


# ── Delivery access (union model) ─────────────────────────────────────────────
# Levels ordered so a higher grant satisfies a lower requirement.
_LEVEL_RANK = {AccessLevel.READ: 1, AccessLevel.WRITE: 2, AccessLevel.CONFIRM: 3}


def check_delivery_access(
    db: Session,
    actor: Actor,
    delivery_id: str,
    required: AccessLevel = AccessLevel.READ,
):
    """Enforce ``is_admin OR is_sender OR is_recipient OR is_assigned_driver OR has_grant``.

    Returns the Delivery on success; raises NotFound / Forbidden otherwise.
    """
    # Imported here to avoid a circular import at module load (Phase 4 wiring).
    from app.models.delivery import Delivery, DeliveryAccess

    delivery = db.get(Delivery, delivery_id)
    if delivery is None:
        raise NotFound("Resource not found.")

    # 1) Administrator — full access.
    if actor.is_admin:
        return delivery

    # 2) Assigned driver — primary access (implicit, not stored).
    if actor.kind == "driver":
        if delivery.driver_id == actor.driver.driver_id:
            return delivery
        raise Forbidden("You do not have access to this resource.")

    # Remaining branches apply to platform users.
    uid = actor.universal_id

    # 3) Sender / 4) Recipient — primary access (implicit, not stored).
    if uid is not None and uid in (delivery.sender_id, delivery.recipient_id):
        return delivery

    # 5) Additional admin-granted access stored in delivery_access.
    grant = db.execute(
        select(DeliveryAccess).where(
            DeliveryAccess.delivery_id == delivery_id,
            DeliveryAccess.participant_id == uid,
        )
    ).scalar_one_or_none()
    if grant is not None and _LEVEL_RANK[grant.access_level] >= _LEVEL_RANK[required]:
        return delivery

    raise Forbidden("You do not have access to this resource.")

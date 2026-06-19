"""Canonical models for the dynamic ``other_info`` / ``other_details`` metadata.

THIS is the single place where the shape of per-entity metadata is decided.
Validation is a STRICT ALLOWLIST: only declared keys are accepted, declared
keys are type-checked, and any key marked required must be present. Unknown
keys are rejected with 400. Supplying no metadata (None / {}) is always valid.

Discriminators (what selects the spec for a row):
  * organization -> OrgType  (Press / Hub / DistributionUnit / Vendor)
  * user         -> UserRole (Administrator / DistributionManager / HubOperator / Vendor)
  * vehicle      -> vehicle_type (falls back to the shared "_default" spec)
  * driver       -> "_default" (single spec)
  * product      -> "_default" (single spec)

To add a field, add it here — nothing else changes.
"""

from app.core.errors import BadRequest

# Python types accepted per key. A tuple means "any of these".
# `int` excludes bool (handled explicitly), since JSON true/false are not counts.
FieldSpec = dict[str, type | tuple[type, ...]]


class _Type:
    INT = int
    STR = str
    BOOL = bool
    LIST = list
    NUM = (int, float)


# ── allowed-key specs ─────────────────────────────────────────────────────────
SPECS: dict[str, dict[str, FieldSpec]] = {
    "organization": {
        "Press": {"printing_capacity": int, "machine_count": int, "daily_editions": int},
        "Hub": {"capacity": int, "city": str, "storage_sections": int},
        "Vendor": {"coverage_area": str, "subscriber_count": int, "delivery_routes": int},
        "DistributionUnit": {"service_area": str, "active_agents": int},
    },
    "user": {
        "Administrator": {"access_level": str, "last_security_training": str},
        "DistributionManager": {"department": str, "shift": str, "managed_hubs": list},
        "HubOperator": {"hub_code": str, "shift": str, "employee_code": str},
        "Vendor": {"coverage_area": str, "subscription_count": int, "assigned_route": str},
    },
    "vehicle": {
        "_default": {
            "fuel_type": str, "insurance_expiry": str, "service_due": str,
            "helmet_count": int, "load_category": str, "gps_enabled": bool,
        },
    },
    "driver": {
        "_default": {
            "license_number": str, "joining_date": str, "experience_years": int,
            "contract_expiry": str, "vendor_company": str,
        },
    },
    "product": {
        # Includes the locked bundle fields that live in Product.other_info.
        "_default": {
            "bundle_id": str, "packing_staff": str, "destination_hub": str,
            "edition": str, "language": str, "publication_date": str, "category": str,
            "issue_number": int, "valid_until": str, "sponsor": str, "campaign_name": str,
        },
    },
}

# Keys that MUST be present when metadata is supplied (empty = none required).
REQUIRED: dict[str, dict[str, set[str]]] = {
    "organization": {},
    "user": {},
    "vehicle": {"_default": set()},
    "driver": {"_default": set()},
    "product": {"_default": set()},
}


def _resolve_spec(entity: str, discriminator: str | None) -> FieldSpec | None:
    by_disc = SPECS.get(entity)
    if by_disc is None:
        return None
    if discriminator is not None and discriminator in by_disc:
        return by_disc[discriminator]
    return by_disc.get("_default")


def _required(entity: str, discriminator: str | None) -> set[str]:
    by_disc = REQUIRED.get(entity, {})
    if discriminator is not None and discriminator in by_disc:
        return by_disc[discriminator]
    return by_disc.get("_default", set())


def _type_ok(value, expected) -> bool:
    # bool is a subclass of int — only accept it where bool is explicitly allowed.
    if expected is int:
        return isinstance(value, int) and not isinstance(value, bool)
    if expected is bool:
        return isinstance(value, bool)
    return isinstance(value, expected)


def validate_other_info(entity: str, discriminator: str | None, data: dict | None) -> None:
    """Strict-allowlist validation. Raises BadRequest(400) on any violation.

    No-op when ``data`` is None or empty.
    """
    if not data:
        return
    if not isinstance(data, dict):
        raise BadRequest("other_info must be an object.",
                         details=[{"field": "other_info", "message": "Expected a JSON object."}])

    spec = _resolve_spec(entity, discriminator)
    if spec is None:
        return  # entity not configured for metadata validation

    errors = []
    for key, value in data.items():
        if key not in spec:
            errors.append({"field": key,
                           "message": f"Unknown key for {entity}"
                                      + (f"/{discriminator}" if discriminator else "")
                                      + "."})
        elif not _type_ok(value, spec[key]):
            exp = spec[key]
            name = getattr(exp, "__name__", str(exp))
            errors.append({"field": key, "message": f"Expected type {name}."})

    for req in _required(entity, discriminator):
        if req not in data:
            errors.append({"field": req, "message": "Required metadata key is missing."})

    if errors:
        raise BadRequest("other_info failed validation.", details=errors)

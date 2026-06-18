"""Phase 2 checkpoint: resolve both input forms; expand a user and an org ref."""

import pytest

from app.core.errors import BadRequest, NotFound
from app.core.identity import create_organization, create_user
from app.models.enums import EntityType, OrgType, UserRole
from app.services.references import expand_reference, resolve_actor_input


@pytest.fixture()
def seeded(db):
    org = create_organization(db, name="Hyderabad Hub", type=OrgType.Hub, email="hub@x.com")
    user = create_user(
        db, organization_id=org.id, name="Asha Rao", email="asha@x.com",
        role=UserRole.DistributionManager,
    )
    db.commit()
    return org, user


def test_resolve_by_universal_id(db, seeded):
    org, _ = seeded
    assert resolve_actor_input(db, universal_id=org.universal_id) == org.universal_id


def test_resolve_by_id_and_type(db, seeded):
    org, user = seeded
    # ORG form
    assert resolve_actor_input(db, id=org.id, type=EntityType.ORG) == org.universal_id
    # USER form
    assert resolve_actor_input(db, id=user.id, type=EntityType.USER) == user.universal_id


def test_resolve_requires_a_form(db):
    with pytest.raises(BadRequest):
        resolve_actor_input(db)


def test_resolve_unknown_raises_not_found(db):
    with pytest.raises(NotFound):
        resolve_actor_input(db, universal_id="00000000-0000-0000-0000-000000000000")
    with pytest.raises(NotFound):
        resolve_actor_input(db, id="00000000-0000-0000-0000-000000000000", type=EntityType.USER)


def test_expand_user_reference(db, seeded):
    _, user = seeded
    ref = expand_reference(db, user.universal_id)
    assert ref.universal_id == user.universal_id
    assert ref.entity_type == EntityType.USER
    assert ref.entity_id == user.id
    assert ref.name == "Asha Rao"


def test_expand_org_reference(db, seeded):
    org, _ = seeded
    ref = expand_reference(db, org.universal_id)
    assert ref.entity_type == EntityType.ORG
    assert ref.entity_id == org.id
    assert ref.name == "Hyderabad Hub"


def test_expand_none_is_none(db):
    assert expand_reference(db, None) is None

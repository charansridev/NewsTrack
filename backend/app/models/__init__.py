"""Importing this package registers every ORM model on ``Base.metadata``."""

from app.models.address import Address
from app.models.delivery import Delivery, DeliveryAccess, DeliveryItem
from app.models.driver import Driver
from app.models.issue import Issue
from app.models.logs import DeliveryAssignmentLog, DeliveryLog, IssueLog
from app.models.notification import Notification
from app.models.organization import Organization
from app.models.product import Product
from app.models.universal_id import UniversalID
from app.models.user import User
from app.models.vehicle import Vehicle

__all__ = [
    "Address",
    "Delivery",
    "DeliveryAccess",
    "DeliveryItem",
    "DeliveryAssignmentLog",
    "DeliveryLog",
    "Driver",
    "Issue",
    "IssueLog",
    "Notification",
    "Organization",
    "Product",
    "UniversalID",
    "User",
    "Vehicle",
]

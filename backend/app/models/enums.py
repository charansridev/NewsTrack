import enum


class UserRole(str, enum.Enum):
    Administrator = "Administrator"
    DistributionManager = "DistributionManager"
    HubOperator = "HubOperator"
    Vendor = "Vendor"


class OrgType(str, enum.Enum):
    Press = "Press"
    Hub = "Hub"
    DistributionUnit = "DistributionUnit"
    Vendor = "Vendor"


class EntityType(str, enum.Enum):
    USER = "USER"
    ORG = "ORG"


class DeliveryType(str, enum.Enum):
    Delivery = "Delivery"
    Handend = "Handend"


class DeliveryStatus(str, enum.Enum):
    Created = "Created"
    Packed = "Packed"
    Dispatched = "Dispatched"
    OutForDelivery = "OutForDelivery"
    Delivered = "Delivered"
    Terminated = "Terminated"


# Legal forward transitions for the canonical delivery lifecycle.
# Terminated is reachable from any non-terminal state.
DELIVERY_FORWARD_ORDER = [
    DeliveryStatus.Created,
    DeliveryStatus.Packed,
    DeliveryStatus.Dispatched,
    DeliveryStatus.OutForDelivery,
    DeliveryStatus.Delivered,
]

DELIVERY_TERMINAL_STATES = {DeliveryStatus.Delivered, DeliveryStatus.Terminated}


class DeliveryItemStatus(str, enum.Enum):
    Pending = "Pending"
    Confirmed = "Confirmed"
    Discrepancy = "Discrepancy"
    Missed = "Missed"


class IssueStatus(str, enum.Enum):
    Open = "Open"
    Assigned = "Assigned"
    InProgress = "InProgress"
    Resolved = "Resolved"
    Escalated = "Escalated"


class AssignmentAction(str, enum.Enum):
    DRIVER_ASSIGNED = "DRIVER_ASSIGNED"
    DRIVER_CHANGED = "DRIVER_CHANGED"
    DRIVER_REMOVED = "DRIVER_REMOVED"
    VEHICLE_ASSIGNED = "VEHICLE_ASSIGNED"
    VEHICLE_CHANGED = "VEHICLE_CHANGED"
    VEHICLE_REMOVED = "VEHICLE_REMOVED"


class IssueLogAction(str, enum.Enum):
    ISSUE_CREATED = "ISSUE_CREATED"
    ASSIGNED = "ASSIGNED"
    REASSIGNED = "REASSIGNED"
    COMMENT_ADDED = "COMMENT_ADDED"
    STATUS_CHANGED = "STATUS_CHANGED"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"


class AccessLevel(str, enum.Enum):
    READ = "READ"
    WRITE = "WRITE"
    CONFIRM = "CONFIRM"


class NotificationSeverity(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import IssueStatus, NotificationSeverity
from app.schemas.references import ActorInput, ActorRef


class IssueCreate(BaseModel):
    type: str
    title: str
    description: str | None = None
    delivery_id: str


class IssueAssignIn(BaseModel):
    assigned_to: ActorInput
    deadline: datetime | None = None
    remark: str | None = None


class IssueStatusIn(BaseModel):
    status: IssueStatus
    resolution_note: str | None = None
    remark: str | None = None


class IssueCommentIn(BaseModel):
    remark: str


class IssueOut(BaseModel):
    id: str
    type: str
    title: str
    description: str | None = None
    delivery_id: str
    assigned_to: ActorRef | None = None
    assigned_at: datetime | None = None
    deadline: datetime | None = None
    status: IssueStatus
    resolution_note: str | None = None
    created_by: ActorRef | None = None
    created_at: datetime | None = None
    resolved_by: ActorRef | None = None
    resolved_at: datetime | None = None


class IssueLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    issue_id: str
    action: str
    remark: str | None = None
    user_id: str | None = None
    created_at: datetime


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str | None = None
    severity: NotificationSeverity | None = None
    recipient_id: str
    issue_id: str | None = None
    message: str | None = None
    is_read: bool = False
    created_by: str | None = None
    created_at: datetime
    cleared_at: datetime | None = None

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.errors import BadRequest
from app.database import get_db
from app.models.user import User
from app.services.analytics import (
    daily_summary,
    delivery_success,
    org_performance,
    route_performance,
)
from app.services.pdf import build_report_pdf

router = APIRouter(tags=["Routes & Analytics"])


@router.get("/routes/performance")
def routes_performance(
    sender_address_id: str | None = Query(default=None),
    recipient_address_id: str | None = Query(default=None),
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return {"data": route_performance(db, sender_address_id, recipient_address_id, from_, to)}


@router.get("/reports/daily-summary")
def reports_daily_summary(
    date_: date | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    on_date = date_ or datetime.now(timezone.utc).date()
    return daily_summary(db, on_date)


@router.get("/reports/delivery-success")
def reports_delivery_success(
    group_by: str = Query(default="route"),
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if group_by not in ("route", "vendor", "hub"):
        raise BadRequest("group_by must be one of: route, vendor, hub.")
    return delivery_success(db, group_by, from_, to)


@router.get("/reports/export")
def reports_export(
    report: str = Query(...),
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if report == "daily-summary":
        on_date = (from_.date() if from_ else datetime.now(timezone.utc).date())
        s = daily_summary(db, on_date)
        cols = ["Metric", "Value"]
        rows = [[k.replace("_", " ").title(), v] for k, v in s.items()]
        pdf = build_report_pdf("Daily Summary", cols, rows, from_=from_, to=to)
    elif report == "delivery-success":
        res = delivery_success(db, "route", from_, to)
        cols = ["Key", "Success %", "Total", "Delivered", "Missed"]
        rows = [[r["key"], r["success_rate"], r["total"], r["delivered"], r["missed"]]
                for r in res["data"]]
        pdf = build_report_pdf("Delivery Success", cols, rows, from_=from_, to=to)
    elif report == "route-performance":
        data = route_performance(db, None, None, from_, to)
        cols = ["Sender Addr", "Recipient Addr", "Runs", "Min", "Max", "Avg", "On-time %", "Delay %"]
        rows = [[r["sender_address_id"], r["recipient_address_id"], r["total_runs"],
                 r["min_duration"], r["max_duration"], r["avg_duration"],
                 r["on_time_pct"], r["delay_frequency"]] for r in data]
        pdf = build_report_pdf("Route Performance", cols, rows, from_=from_, to=to)
    elif report == "vendor-performance":
        res = delivery_success(db, "vendor", from_, to)
        cols = ["Vendor", "Success %", "Total", "Delivered", "Missed"]
        rows = [[r["key"], r["success_rate"], r["total"], r["delivered"], r["missed"]]
                for r in res["data"]]
        pdf = build_report_pdf("Vendor Performance", cols, rows, from_=from_, to=to)
    else:
        raise BadRequest(
            "report must be one of: daily-summary, delivery-success, "
            "route-performance, vendor-performance."
        )

    filename = f"{report}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

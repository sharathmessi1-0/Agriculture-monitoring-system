from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Alert, Field
from app.models import utc_now
from app.schemas import AlertRead
from app.services.alerts import evaluate_reading_freshness

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertRead])
def list_alerts(
    status: str | None = Query(default=None, pattern="^(active|resolved)$"),
    field_id: int | None = None,
    include_demo: bool = True,
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    evaluate_reading_freshness(db)
    db.commit()
    statement = select(Alert).order_by(Alert.created_at.desc(), Alert.id.desc()).limit(limit)
    if status:
        statement = statement.where(Alert.status == status)
    if field_id is not None:
        statement = statement.where(Alert.field_id == field_id)
    if not include_demo:
        statement = statement.where(Alert.is_demo.is_(False))
    return db.scalars(statement).all()


@router.patch("/{alert_id}/resolve", response_model=AlertRead)
@router.post("/{alert_id}/resolve", response_model=AlertRead)
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.status == "active":
        alert.status = "resolved"
        alert.resolved_at = utc_now()
        db.commit()
        db.refresh(alert)
    return alert


@router.get("/fields/{field_id}", response_model=list[AlertRead])
def field_alerts(field_id: int, db: Session = Depends(get_db)):
    if db.get(Field, field_id) is None:
        raise HTTPException(status_code=404, detail="Field not found")
    return db.scalars(select(Alert).where(Alert.field_id == field_id).order_by(Alert.created_at.desc())).all()

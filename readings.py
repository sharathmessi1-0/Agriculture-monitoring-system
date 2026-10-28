from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Field, Reading
from app.schemas import ReadingCreate, ReadingRead
from app.services.alerts import evaluate_reading

router = APIRouter(prefix="/readings", tags=["readings"])


@router.get("", response_model=list[ReadingRead])
def list_readings(
    field_id: int | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    statement = select(Reading).order_by(Reading.recorded_at.desc(), Reading.id.desc()).limit(limit)
    if field_id is not None:
        statement = statement.where(Reading.field_id == field_id)
    return db.scalars(statement).all()


@router.post("", response_model=ReadingRead, status_code=201)
def create_reading(payload: ReadingCreate, db: Session = Depends(get_db)):
    if db.get(Field, payload.field_id) is None:
        raise HTTPException(status_code=404, detail="Field not found")
    data = payload.model_dump()
    if data["recorded_at"] is None:
        data.pop("recorded_at")
    reading = Reading(**data)
    db.add(reading)
    db.flush()
    evaluate_reading(db, reading)
    db.commit()
    db.refresh(reading)
    return reading

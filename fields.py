from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Field, Reading
from app.schemas import FieldCreate, FieldRead, FieldUpdate, ReadingRead

router = APIRouter(prefix="/fields", tags=["fields"])


@router.get("", response_model=list[FieldRead])
def list_fields(include_demo: bool = True, db: Session = Depends(get_db)):
    statement = select(Field).order_by(Field.id)
    if not include_demo:
        statement = statement.where(Field.is_demo.is_(False))
    return db.scalars(statement).all()


@router.post("", response_model=FieldRead, status_code=201)
def create_field(payload: FieldCreate, db: Session = Depends(get_db)):
    field = Field(**payload.model_dump())
    db.add(field)
    try:
        db.commit()
        db.refresh(field)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A field with this name already exists") from exc
    return field


@router.get("/{field_id}", response_model=FieldRead)
def get_field(field_id: int, db: Session = Depends(get_db)):
    field = db.get(Field, field_id)
    if field is None:
        raise HTTPException(status_code=404, detail="Field not found")
    return field


@router.patch("/{field_id}", response_model=FieldRead)
@router.put("/{field_id}", response_model=FieldRead)
def update_field(field_id: int, payload: FieldUpdate, db: Session = Depends(get_db)):
    field = db.get(Field, field_id)
    if field is None:
        raise HTTPException(status_code=404, detail="Field not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(field, key, value)
    try:
        db.commit()
        db.refresh(field)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A field with this name already exists") from exc
    return field


@router.delete("/{field_id}", status_code=204)
def delete_field(field_id: int, db: Session = Depends(get_db)):
    field = db.get(Field, field_id)
    if field is None:
        raise HTTPException(status_code=404, detail="Field not found")
    db.delete(field)
    db.commit()


@router.get("/{field_id}/readings", response_model=list[ReadingRead])
def field_readings(
    field_id: int,
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    if db.get(Field, field_id) is None:
        raise HTTPException(status_code=404, detail="Field not found")
    return db.scalars(
        select(Reading)
        .where(Reading.field_id == field_id)
        .order_by(Reading.recorded_at.desc(), Reading.id.desc())
        .limit(limit)
    ).all()

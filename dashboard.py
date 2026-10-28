from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Alert, Field, Reading

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
@router.get("")
def dashboard_summary(db: Session = Depends(get_db)):
    latest_readings = db.scalars(
        select(Reading)
        .options(selectinload(Reading.field))
        .order_by(Reading.recorded_at.desc(), Reading.id.desc())
        .limit(1000)
    ).all()
    latest_by_field = {}
    for reading in latest_readings:
        latest_by_field.setdefault(reading.field_id, reading)
    latest_values = list(latest_by_field.values())
    field_count = db.scalar(select(func.count(Field.id))) or 0
    active_alert_count = db.scalar(
        select(func.count(Alert.id)).where(Alert.status == "active")
    ) or 0
    def average(attribute: str) -> float | None:
        if not latest_values:
            return None
        return round(
            sum(getattr(reading, attribute) for reading in latest_values) / len(latest_values),
            2,
        )
    needs_attention = active_alert_count > 0 or any(
        reading.soil_moisture < 30 for reading in latest_values
    )
    return {
        "field_count": field_count,
        "total_fields": field_count,
        "active_alert_count": active_alert_count,
        "average_soil_moisture": average("soil_moisture"),
        "average_temperature": average("temperature_c"),
        "average_humidity": average("humidity_percent"),
        "average_ph": average("soil_ph"),
        "crop_health_status": "Needs attention" if needs_attention else "Good",
        "latest_readings": [
            {
                "field_id": reading.field_id,
                "field_name": reading.field.name,
                "soil_moisture": reading.soil_moisture,
                "temperature_c": reading.temperature_c,
                "humidity_percent": reading.humidity_percent,
                "soil_ph": reading.soil_ph,
                "rainfall_mm": reading.rainfall_mm,
                "recorded_at": reading.recorded_at,
                "is_demo": reading.is_demo,
            }
            for reading in latest_values
        ],
        "demo_data_included": True,
    }

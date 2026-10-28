import logging
from pathlib import Path

import joblib
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Field, Reading
from app.schemas import CropRecommendationRequest, IrrigationRecommendationRead


logger = logging.getLogger(__name__)
FEATURES = [
    "nitrogen",
    "phosphorus",
    "potassium",
    "temperature_c",
    "humidity_percent",
    "soil_ph",
    "rainfall_mm",
    "soil_type",
]
MODEL_PATH = Path(__file__).resolve().parents[1] / "data" / "crop_recommendation.joblib"


def _fallback_crop(request: CropRecommendationRequest) -> str:
    if request.rainfall_mm >= 180 and request.humidity_percent >= 70:
        return "rice"
    if request.temperature_c >= 25 and request.rainfall_mm < 180:
        return "maize"
    return "wheat"


def predict_crop(
    request: CropRecommendationRequest,
) -> tuple[str, str, list[dict[str, str | float]], float | None]:
    if MODEL_PATH.exists():
        try:
            model = joblib.load(MODEL_PATH)
            row = pd.DataFrame([{name: getattr(request, name) for name in FEATURES}])
            probabilities = model.predict_proba(row)[0]
            classes = model.classes_
            ranked = sorted(
                zip(classes, probabilities, strict=True),
                key=lambda item: item[1],
                reverse=True,
            )
            predicted = str(model.predict(row)[0])
            alternatives = [
                {"crop": str(crop), "probability": round(float(probability), 4)}
                for crop, probability in ranked
                if str(crop) != predicted
            ][:3]
            score = next(
                float(probability)
                for crop, probability in ranked
                if str(crop) == predicted
            )
            return predicted, "trained_educational_model", alternatives, round(score, 4)
        except (OSError, ValueError, AttributeError, ImportError, KeyError):
            logger.exception("Could not load or evaluate the educational crop model")

    crop = _fallback_crop(request)
    alternatives = [
        {"crop": candidate, "probability": 0.0}
        for candidate in ("rice", "maize", "wheat")
        if candidate != crop
    ]
    return crop, "educational_fallback", alternatives, None


def irrigation_recommendation(
    db: Session,
    field_id: int,
    moisture_threshold: float = 30,
) -> IrrigationRecommendationRead:
    field = db.get(Field, field_id)
    if field is None:
        raise LookupError("Field not found")
    reading = db.scalar(
        select(Reading)
        .where(Reading.field_id == field_id)
        .order_by(Reading.recorded_at.desc(), Reading.id.desc())
    )
    if reading is None:
        raise LookupError("No readings available for this field")

    if reading.soil_moisture < moisture_threshold:
        recommendation = (
            f"Check irrigation needs: soil moisture is {reading.soil_moisture:.1f}%, "
            f"below your {moisture_threshold:g}% threshold."
        )
    else:
        recommendation = (
            f"Irrigation may not be necessary based on the latest "
            f"{reading.soil_moisture:.1f}% soil-moisture reading."
        )

    context = []
    if field.crop_type:
        context.append(
            f"Recorded crop: {field.crop_type}; crop-stage-specific water needs are not modeled."
        )
    if reading.rainfall_mm is not None:
        context.append(f"Latest recorded rainfall: {reading.rainfall_mm:g} mm.")
    if reading.temperature_c >= 35:
        context.append("The recorded temperature is high; review local conditions.")

    basis = (
        f"Rule-based comparison of the latest recorded soil moisture "
        f"({reading.soil_moisture:.1f}%) with the configured {moisture_threshold:g}% threshold. "
        + " ".join(context)
    )
    return IrrigationRecommendationRead(
        field_id=field_id,
        recommendation=recommendation,
        estimated_liters=None,
        basis=basis,
        disclaimer=(
            "Informational demonstration only. This does not control hardware or "
            "calculate a scientifically calibrated irrigation volume."
        ),
    )

# Agriculture Monitoring API

FastAPI backend for an educational agriculture-monitoring system. All endpoints
are under `/api`; interactive documentation is at `/docs`.

## Run

From this directory, create/activate a virtual environment, install dependencies
from `requirements.txt`, then run:

```powershell
python -m uvicorn app.main:app --reload
```

By default, the persistent SQLite database is `agriculture_monitoring.db` in the
current working directory. Set `DATABASE_URL` to use another SQLAlchemy database
URL. The API allows the frontend origin `http://localhost:5173`.

When an empty database is first initialized, one sample field and two sample
readings are seeded. Their field name/location and `is_demo` flags identify them
as DEMO data. Reports and relevant list endpoints can exclude demo data.

## API areas

- `GET /api/health`, `GET /api/dashboard` (also `/api/dashboard/summary`)
- `GET|POST /api/fields`, `GET|PUT|DELETE /api/fields/{id}`, field readings
- `GET|POST /api/readings`; out-of-range readings create alerts and recovered
  readings resolve corresponding active alerts
- `GET /api/alerts`, `PATCH /api/alerts/{id}/resolve`
- `POST /api/recommendations/crops`,
  `POST /api/recommendations/irrigation` with field ID and configurable threshold
- `GET /api/reports/readings` filtered by optional `field_id`, `start_date`,
  `end_date`, and `include_demo`; aggregate summary is `/api/reports/summary`

## Educational crop model

`app/ml/educational_crop_data.csv` is a small, explicitly illustrative synthetic
dataset, not a sourced agricultural study or field-calibrated data. Train and
persist a deterministic Random Forest pipeline with numeric nutrient/weather
features and a one-hot encoded soil type using:

```powershell
python -m app.ml.train_model
```

The script writes `app/data/crop_recommendation.joblib`, loaded by the crop
recommendation endpoint when present. Without a trained model, the API returns
an explicitly labelled educational rule-based fallback. Model outputs and the
irrigation recommendations are demonstrations only, not agronomic advice.

## Tests

Run `python -m pytest -q -p no:cacheprovider` from this directory.

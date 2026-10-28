import { useState } from 'react'
import { BrainCircuit, Sprout } from 'lucide-react'
import { Notice, PageIntro, Field } from '../components/ui'
import api, { errorMessage } from '../services/api'

const initial = { nitrogen: '80', phosphorus: '40', potassium: '40', temperature: '25', humidity: '70', soil_ph: '6.5', rainfall: '100', soil_type: 'Loamy' }
const inputFields = [
  ['nitrogen', 'Nitrogen (N)', 0, 200, 'kg/ha'],
  ['phosphorus', 'Phosphorus (P)', 0, 200, 'kg/ha'],
  ['potassium', 'Potassium (K)', 0, 200, 'kg/ha'],
  ['temperature', 'Temperature', -10, 60, '°C'],
  ['humidity', 'Humidity', 0, 100, '%'],
  ['soil_ph', 'Soil pH', 0, 14, ''],
  ['rainfall', 'Rainfall', 0, 1000, 'mm'],
]

export default function Recommendations({ notify }) {
  const [values, setValues] = useState(initial)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true); setError(''); setResult(null)
    try {
      const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, key === 'soil_type' ? value : Number(value)]))
      const response = await api.post('/recommendations/crops', payload)
      setResult(response.data)
      notify('Crop recommendation generated.')
    } catch (requestError) { setError(errorMessage(requestError)) }
    finally { setLoading(false) }
  }
  const crop = result?.recommended_crop || result?.crop || result?.recommendation
  const alternatives = result?.alternatives || result?.top_crops || result?.top_alternatives || []
  const probability = result?.suitability_score ?? result?.probability ?? result?.confidence
  const reasons = result?.reasons || result?.explanation || []
  const guidance = result?.guidance || result?.farming_guidance || 'Use local agronomic advice and field conditions to validate any crop choice.'
  return <>
    <PageIntro eyebrow="Educational machine learning" title="Crop recommendation" description="Explore a model suggestion based on soil nutrients and local environmental inputs." />
    <div className="notice warning"><BrainCircuit size={15} />This is an educational demonstration model trained on a small synthetic dataset. Its scores are model confidence—not yield forecasts or scientifically validated suitability advice.</div>
    <div className="grid recommend-grid section-spacer">
      <section className="panel">
        <div className="panel-header"><div><h2 className="panel-title">Growing conditions</h2><div className="panel-subtitle">Enter soil and climate values to request a model prediction.</div></div></div>
        <form onSubmit={submit}><div className="form-grid">
          {inputFields.map(([key, label, min, max, unit]) => <Field key={key} label={`${label}${unit ? ` (${unit})` : ''}`}><input className="input" type="number" required min={min} max={max} step="0.1" value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} /></Field>)}
          <Field label="Soil type"><select className="select" value={values.soil_type} onChange={(e) => setValues({ ...values, soil_type: e.target.value })}>{['Loamy', 'Sandy', 'Clay', 'Silt', 'Black', 'Red', 'Other'].map((soil) => <option key={soil}>{soil}</option>)}</select></Field>
        </div>
        {error && <div className="form-error"><Notice tone="error">{error}</Notice></div>}
        <div className="form-actions"><button className="button" disabled={loading}><Sprout size={15} />{loading ? 'Evaluating…' : 'Get recommendation'}</button></div></form>
      </section>
      <section className="panel result-panel">
        <div className="panel-header"><div><h2 className="panel-title">Recommendation result</h2><div className="panel-subtitle">A starting point for educational exploration</div></div></div>
        {result && crop ? <div className="recommendation-card"><div className="crop-result"><div><div className="result-section-title">Suggested crop</div><div className="crop-name">{String(crop).replaceAll('_', ' ')}</div></div><div className="score-wrap"><div className="score">{probability == null ? '—' : `${Math.round(Number(probability) <= 1 ? Number(probability) * 100 : Number(probability))}%`}</div><div className="score-label">classifier confidence only</div></div></div>
          {result.method && <div className="result-model">Method: {result.method.replaceAll('_', ' ')}</div>}
          {!!alternatives.length && <div className="result-section"><div className="result-section-title">Other model-ranked options</div><div className="crop-chips">{alternatives.map((item, index) => <span className="crop-chip" key={typeof item === 'string' ? item : item.crop || index}>{typeof item === 'string' ? item : `${item.crop || item.name}${item.probability != null ? ` · ${Math.round(item.probability <= 1 ? item.probability * 100 : item.probability)}%` : ''}`}</span>)}</div></div>}
          <div className="result-section"><div className="result-section-title">Why this result?</div><div className="result-text">{Array.isArray(reasons) ? <ul className="reason-list">{reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul> : reasons || 'The model matched the supplied inputs against its educational training examples.'}</div></div>
          <div className="result-section"><div className="result-section-title">Basic guidance</div><div className="result-text">{guidance}</div></div>
          {result.disclaimer && <div className="result-caveat">{result.disclaimer}</div>}
        </div> : <div className="empty-state result-empty"><div className="result-icon"><Sprout size={22} /></div><strong>Your result will appear here</strong>Fill in the inputs and ask the demonstration model for a suggestion.</div>}
      </section>
    </div>
    <div className="notice info section-spacer"><BrainCircuit size={15} />Model training examples are synthetic educational data. Inputs are not checked against a specific location, season, cultivar, or laboratory soil test. Consult a qualified local agricultural advisor before making real planting decisions.</div>
  </>
}

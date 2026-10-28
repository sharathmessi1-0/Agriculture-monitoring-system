import { useMemo, useState } from 'react'
import { Activity, Edit3, Plus, Thermometer, Trash2 } from 'lucide-react'
import api, { errorMessage } from '../services/api'
import { Empty, Field, Loading, Notice, PageIntro, StatusBadge } from '../components/ui'

const emptyField = { name: '', crop_type: '', area: '', soil_type: '', location: '' }
const emptyReading = { field_id: '', soil_moisture: '', temperature: '', humidity: '', soil_ph: '', rainfall: '' }
const dateOf = (item) => item.recorded_at || item.created_at || item.timestamp

function Modal({ title, onClose, children }) {
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2 className="modal-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}>×</button></div>{children}</section></div>
}

export default function Fields({ fields, readings, loading, refresh, notify }) {
  const [dialog, setDialog] = useState('')
  const [editing, setEditing] = useState(null)
  const [fieldForm, setFieldForm] = useState(emptyField)
  const [readingForm, setReadingForm] = useState(emptyReading)
  const [selectedField, setSelectedField] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => readings.filter((reading) => {
    if (selectedField !== 'all' && String(reading.field_id) !== selectedField) return false
    const time = new Date(dateOf(reading))
    if (from && time < new Date(`${from}T00:00:00`)) return false
    if (to && time > new Date(`${to}T23:59:59`)) return false
    return true
  }), [readings, selectedField, from, to])

  const openAdd = () => { setEditing(null); setFieldForm(emptyField); setError(''); setDialog('field') }
  const openEdit = (field) => { setEditing(field); setFieldForm({ name: field.name || '', crop_type: field.crop_type || '', area: field.area ?? field.area_hectares ?? '', soil_type: field.soil_type || '', location: field.location || '' }); setError(''); setDialog('field') }
  const submitField = async (event) => {
    event.preventDefault()
    if (Number(fieldForm.area) <= 0) { setError('Area must be greater than zero.'); return }
    setSaving(true); setError('')
    try {
      const { area, ...details } = fieldForm
      const payload = { ...details, area_hectares: Number(area) }
      if (editing) await api.put(`/fields/${editing.id}`, payload)
      else await api.post('/fields', payload)
      await refresh(['dashboard', 'fields', 'readings', 'alerts'])
      notify(editing ? 'Field details updated.' : 'Field added successfully.')
      setDialog(''); setFieldForm(emptyField)
    } catch (requestError) { setError(errorMessage(requestError)) }
    finally { setSaving(false) }
  }
  const removeField = async (field) => {
    if (!window.confirm(`Delete "${field.name}" and its associated monitoring records?`)) return
    try { await api.delete(`/fields/${field.id}`); await refresh(['dashboard', 'fields', 'readings', 'alerts']); notify('Field deleted.') }
    catch (requestError) { setError(errorMessage(requestError)) }
  }
  const submitReading = async (event) => {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = Object.fromEntries(Object.entries(readingForm).map(([key, value]) => [key, key === 'field_id' ? Number(value) : Number(value)]))
      await api.post('/readings', payload)
      await refresh(['dashboard', 'fields', 'readings', 'alerts'])
      notify('Field reading recorded.')
      setDialog('')
      setReadingForm({ ...emptyReading, field_id: String(fields[0]?.id || '') })
    } catch (requestError) { setError(errorMessage(requestError)) }
    finally { setSaving(false) }
  }

  return <>
    <PageIntro eyebrow="Your farm" title="Field monitoring" description="Keep field details and recorded observations in one place." actions={<div className="toolbar"><button className="button secondary" onClick={() => { if (!fields.length) { setError('Add a field before recording a reading.'); return } setError(''); setReadingForm({ ...emptyReading, field_id: String(fields[0].id) }); setDialog('reading') }}><Activity size={14} /> Record reading</button><button className="button" onClick={openAdd}><Plus size={15} /> Add field</button></div>} />
    {error && !dialog && <div className="section-spacer"><Notice tone="error">{error}</Notice></div>}
    <section className="panel">
      <div className="panel-header"><div><h2 className="panel-title">Your fields</h2><div className="panel-subtitle">{fields.length} field{fields.length === 1 ? '' : 's'} configured</div></div></div>
      {loading ? <Loading /> : fields.length ? <div className="table-wrap"><table><thead><tr><th>FIELD</th><th>CROP</th><th>AREA (HA)</th><th>SOIL TYPE</th><th>LOCATION</th><th>OBSERVATIONS</th><th>ACTIONS</th></tr></thead><tbody>{fields.map((field) => {
        const latest = readings.filter((r) => r.field_id === field.id).sort((a, b) => new Date(dateOf(b)) - new Date(dateOf(a)))[0]
        return <tr key={field.id}><td className="field-name">{field.name}</td><td>{field.crop_type}</td><td>{Number(field.area ?? field.area_hectares).toLocaleString()}</td><td>{field.soil_type}</td><td>{field.location}</td><td>{latest ? <StatusBadge tone={Number(latest.soil_moisture) < 30 ? 'amber' : 'green'}>{latest.soil_moisture}% moisture</StatusBadge> : <StatusBadge>Awaiting reading</StatusBadge>}</td><td><div className="row-actions"><button className="icon-button" title="Edit field" aria-label={`Edit ${field.name}`} onClick={() => openEdit(field)}><Edit3 size={14} /></button><button className="icon-button remove-button" title="Delete field" aria-label={`Delete ${field.name}`} onClick={() => removeField(field)}><Trash2 size={14} /></button></div></td></tr>
      })}</tbody></table></div> : <Empty title="No fields added yet">Add a field to start recording environmental observations.</Empty>}
    </section>
    <section className="panel section-spacer">
      <div className="filters"><div><h2 className="panel-title">Reading history</h2><div className="panel-subtitle">Filter historical readings by field and date</div></div><div className="toolbar"><select className="select" aria-label="Filter by field" value={selectedField} onChange={(e) => setSelectedField(e.target.value)}><option value="all">All fields</option>{fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select><input className="input date-filter" type="date" aria-label="Start date" value={from} onChange={(e) => setFrom(e.target.value)} /><input className="input date-filter" type="date" aria-label="End date" value={to} onChange={(e) => setTo(e.target.value)} /><button className="button secondary small" onClick={() => { setSelectedField('all'); setFrom(''); setTo('') }}>Clear</button></div></div>
      {loading ? <Loading /> : filtered.length ? <div className="table-wrap"><table><thead><tr><th>FIELD</th><th>DATA SOURCE</th><th>MOISTURE</th><th>TEMP.</th><th>HUMIDITY</th><th>SOIL PH</th><th>RAINFALL</th><th>RECORDED AT</th></tr></thead><tbody>{filtered.slice().sort((a, b) => new Date(dateOf(b)) - new Date(dateOf(a))).map((reading) => <tr key={reading.id}><td className="field-name">{reading.field_name || fields.find((f) => f.id === reading.field_id)?.name || 'Unknown field'}</td><td><StatusBadge tone={reading.is_demo ? 'amber' : 'green'}>{reading.is_demo ? 'DEMO' : 'Recorded'}</StatusBadge></td><td>{reading.soil_moisture}%</td><td>{reading.temperature} °C</td><td>{reading.humidity}%</td><td>{reading.soil_ph}</td><td>{reading.rainfall} mm</td><td>{new Date(dateOf(reading)).toLocaleString()}</td></tr>)}</tbody></table></div> : <Empty title="No readings match">Try changing your filters or record a new observation.</Empty>}
    </section>
    {dialog === 'field' && <Modal title={editing ? 'Edit field' : 'Add a field'} onClose={() => setDialog('')}><form onSubmit={submitField}><div className="form-grid"><Field label="Field name"><input className="input" required maxLength="80" placeholder="e.g. North Plot" value={fieldForm.name} onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })} /></Field><Field label="Crop type"><input className="input" required maxLength="80" placeholder="e.g. Wheat" value={fieldForm.crop_type} onChange={(e) => setFieldForm({ ...fieldForm, crop_type: e.target.value })} /></Field><Field label="Area (hectares)"><input className="input" required type="number" min="0.01" step="0.01" value={fieldForm.area} onChange={(e) => setFieldForm({ ...fieldForm, area: e.target.value })} /></Field><Field label="Soil type"><select className="select" required value={fieldForm.soil_type} onChange={(e) => setFieldForm({ ...fieldForm, soil_type: e.target.value })}><option value="">Select soil</option>{['Loamy', 'Sandy', 'Clay', 'Silt', 'Black', 'Red', 'Other'].map((soil) => <option key={soil}>{soil}</option>)}</select></Field><Field label="Location"><input className="input" required maxLength="120" placeholder="Village or area" value={fieldForm.location} onChange={(e) => setFieldForm({ ...fieldForm, location: e.target.value })} /></Field></div>{error && <div className="form-error"><Notice tone="error">{error}</Notice></div>}<div className="form-actions"><button type="button" className="button secondary" onClick={() => setDialog('')}>Cancel</button><button className="button" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add field'}</button></div></form></Modal>}
    {dialog === 'reading' && <Modal title="Record field reading" onClose={() => setDialog('')}><form onSubmit={submitReading}><div className="form-grid"><Field label="Field"><select className="select" required value={readingForm.field_id} onChange={(e) => setReadingForm({ ...readingForm, field_id: e.target.value })}>{fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select></Field><Field label="Soil moisture (%)"><input className="input" required type="number" min="0" max="100" step="0.1" value={readingForm.soil_moisture} onChange={(e) => setReadingForm({ ...readingForm, soil_moisture: e.target.value })} /></Field><Field label="Temperature (°C)"><input className="input" required type="number" min="-30" max="70" step="0.1" value={readingForm.temperature} onChange={(e) => setReadingForm({ ...readingForm, temperature: e.target.value })} /></Field><Field label="Humidity (%)"><input className="input" required type="number" min="0" max="100" step="0.1" value={readingForm.humidity} onChange={(e) => setReadingForm({ ...readingForm, humidity: e.target.value })} /></Field><Field label="Soil pH"><input className="input" required type="number" min="0" max="14" step="0.1" value={readingForm.soil_ph} onChange={(e) => setReadingForm({ ...readingForm, soil_ph: e.target.value })} /></Field><Field label="Rainfall (mm)"><input className="input" required type="number" min="0" max="1000" step="0.1" value={readingForm.rainfall} onChange={(e) => setReadingForm({ ...readingForm, rainfall: e.target.value })} /></Field></div>{error && <div className="form-error"><Notice tone="error">{error}</Notice></div>}<div className="form-actions"><button type="button" className="button secondary" onClick={() => setDialog('')}>Cancel</button><button className="button" disabled={saving}>{saving ? 'Saving…' : 'Save reading'}</button></div></form></Modal>}
  </>
}

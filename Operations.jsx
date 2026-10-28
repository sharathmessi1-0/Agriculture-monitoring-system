import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Download, Droplets, RotateCcw, Settings as SettingsIcon } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Empty, Field, Loading, Notice, PageIntro, StatusBadge } from '../components/ui'
import api, { errorMessage, normalizeReading } from '../services/api'
import { createReadingsCsv } from '../services/csv'

const thresholdKey = 'fieldwise-moisture-threshold'
const getThreshold = () => {
  const saved = Number(localStorage.getItem(thresholdKey))
  return Number.isFinite(saved) && saved >= 1 && saved <= 100 ? saved : 30
}
const timeOf = (item) => item.recorded_at || item.created_at || item.timestamp

export function Irrigation({ fields, readings, notify }) {
  const [threshold, setThreshold] = useState(getThreshold)
  const [results, setResults] = useState({})
  const [error, setError] = useState('')
  const [loadingField, setLoadingField] = useState(null)
  const latest = useMemo(() => new Map(fields.map((field) => [field.id, readings.filter((reading) => reading.field_id === field.id).sort((a, b) => new Date(timeOf(b)) - new Date(timeOf(a)))[0]])), [fields, readings])

  const saveThreshold = (value) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) { setError('Enter a moisture threshold between 1 and 100%.'); return }
    setThreshold(parsed); localStorage.setItem(thresholdKey, String(parsed)); setError(''); notify('Irrigation threshold saved.')
  }
  const checkField = async (field) => {
    setLoadingField(field.id); setError('')
    try {
      const response = await api.post('/recommendations/irrigation', { field_id: field.id, moisture_threshold: threshold })
      setResults((old) => ({ ...old, [field.id]: response.data }))
    } catch (requestError) { setError(errorMessage(requestError)) }
    finally { setLoadingField(null) }
  }
  return <>
    <PageIntro eyebrow="Water management" title="Irrigation management" description="Rule-based guidance from field moisture readings. No physical pump control is connected." />
    <div className="notice warning"><Droplets size={15} />Recommendations are informational only. They do not operate a pump, valve, or irrigation hardware.</div>
    <section className="panel section-spacer threshold-panel">
      <div className="panel-header"><div><h2 className="panel-title">Moisture threshold</h2><div className="panel-subtitle">A reading below this value triggers an irrigation needs check.</div></div><StatusBadge tone="gray">Saved on this device</StatusBadge></div>
      <div className="threshold-control"><Field label="Trigger below (%)"><input className="input" type="number" min="1" max="100" step="1" value={threshold} onChange={(e) => setThreshold(e.target.value)} onBlur={(e) => saveThreshold(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveThreshold(e.currentTarget.value)} /></Field><button className="button secondary" onClick={() => saveThreshold(threshold)}>Save threshold</button><span className="threshold-hint">Current threshold: <strong>{threshold}%</strong></span></div>
    </section>
    {error && <div className="section-spacer"><Notice tone="error">{error}</Notice></div>}
    <div className="grid irrigation-grid section-spacer">
      {fields.length ? fields.map((field) => {
        const reading = latest.get(field.id)
        const result = results[field.id]
        const isLow = reading && Number(reading.soil_moisture) < Number(threshold)
        return <article className="panel irrigation-card" key={field.id}>
          <div className="panel-header"><div><h2 className="panel-title">{field.name}</h2><div className="panel-subtitle">{field.crop_type} · {field.location}</div></div><span className={`moisture-icon ${isLow ? 'low' : ''}`}><Droplets size={17} /></span></div>
          {reading ? <><div className="reading-highlight"><span className="reading-number">{Number(reading.soil_moisture).toFixed(1)}<small>%</small></span><span className="reading-caption">latest soil moisture</span><StatusBadge tone={isLow ? 'amber' : 'green'}>{isLow ? 'Below threshold' : 'Adequate'}</StatusBadge></div><div className="panel-subtitle reading-date">Recorded {new Date(timeOf(reading)).toLocaleString()}</div></> : <div className="empty-state"><strong>No reading available</strong>Record a field reading to assess irrigation needs.</div>}
          {result && <div className={`irrigation-result ${String(result.recommendation || result.status || '').toLowerCase().includes('check') || String(result.recommendation || result.status || '').toLowerCase().includes('irrigat') ? 'result-warn' : ''}`}><strong>{result.recommendation || result.status || 'Assessment complete'}</strong><div>{result.basis || result.reason || result.message || `The recorded moisture is ${isLow ? 'below' : 'at or above'} your ${threshold}% threshold.`}</div><div className="irrigation-disclaimer">{result.disclaimer}</div></div>}
          <button className="button secondary small check-button" disabled={!reading || loadingField === field.id} onClick={() => checkField(field)}>{loadingField === field.id ? 'Checking…' : 'Check irrigation guidance'}</button>
        </article>
      }) : <section className="panel"><Empty title="No fields to assess">Add a field and record a reading to view irrigation guidance.</Empty></section>}
    </div>
  </>
}

export function Alerts({ alerts, fields, loading, refresh, notify }) {
  const [error, setError] = useState('')
  const resolve = async (alert) => {
    setError('')
    try { await api.patch(`/alerts/${alert.id}/resolve`); await refresh(['alerts', 'dashboard']); notify('Alert marked as resolved.') }
    catch (requestError) { setError(errorMessage(requestError)) }
  }
  const isResolved = (alert) => Boolean(alert.resolved || alert.is_resolved || alert.status === 'resolved')
  const open = alerts.filter((alert) => !isResolved(alert))
  const resolved = alerts.filter(isResolved)
  return <>
    <PageIntro eyebrow="Monitoring notices" title="Alerts" description="Alerts are generated from recorded readings and time-based checks, not live sensors." actions={<span className="badge amber">{open.length} OPEN</span>} />
    {error && <div className="section-spacer"><Notice tone="error">{error}</Notice></div>}
    <section className="panel section-spacer"><div className="panel-header"><div><h2 className="panel-title">Needs attention</h2><div className="panel-subtitle">Low moisture, environmental thresholds, and data freshness</div></div></div>
      {loading ? <Loading /> : open.length ? <div className="alert-list">{open.map((alert) => <AlertCard key={alert.id} alert={alert} fields={fields} onResolve={() => resolve(alert)} />)}</div> : <Empty title="No open alerts">There are no unresolved monitoring alerts.</Empty>}
    </section>
    <section className="panel section-spacer"><div className="panel-header"><div><h2 className="panel-title">Resolved alerts</h2><div className="panel-subtitle">Previously reviewed notices</div></div></div>{resolved.length ? <div className="alert-list">{resolved.map((alert) => <AlertCard key={alert.id} alert={alert} fields={fields} resolved />)}</div> : <Empty title="No resolved alerts">Resolved items will appear here.</Empty>}</section>
  </>
}

function AlertCard({ alert, fields, resolved, onResolve }) {
  const field = alert.field_name || fields.find((item) => item.id === alert.field_id)?.name || 'Unknown field'
  const title = alert.title || alert.message || alert.alert_type || 'Monitoring notice'
  const high = ['high', 'critical'].includes(String(alert.severity).toLowerCase())
  return <article className="alert-item"><div className={`alert-mark ${high ? 'alert-mark-high' : ''}`}>{resolved ? <Check size={16} /> : <AlertTriangle size={16} />}</div><div className="alert-body"><div className="alert-title">{title}</div><div className="alert-detail">{alert.description || alert.suggested_action || 'Review field conditions and latest observations.'}</div><div className="alert-meta"><StatusBadge tone={high ? 'red' : 'amber'}>{alert.severity || 'medium'}</StatusBadge><span className="alert-detail">{field}</span><span className="alert-detail">{new Date(alert.created_at || alert.timestamp).toLocaleString()}</span></div></div>{!resolved && <button className="button secondary small" onClick={onResolve}>Mark resolved</button>}</article>
}

export function Reports({ fields, readings }) {
  const [fieldId, setFieldId] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [apiRows, setApiRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const selectedRows = useMemo(() => readings.filter((row) => {
    if (fieldId !== 'all' && String(row.field_id) !== fieldId) return false
    const date = new Date(timeOf(row))
    if (from && date < new Date(`${from}T00:00:00`)) return false
    if (to && date > new Date(`${to}T23:59:59`)) return false
    return true
  }), [readings, fieldId, from, to])
  const rows = apiRows || selectedRows
  const refresh = async () => {
    if (from && to && from > to) {
      setError('Start date must be on or before the end date.')
      setApiRows([])
      setLoading(false)
      return
    }
    setLoading(true); setError('')
    try {
      const params = {}
      if (fieldId !== 'all') params.field_id = fieldId
      if (from) params.start_date = from
      if (to) params.end_date = to
      const response = await api.get('/reports/readings', { params })
      const data = response.data
      setApiRows((Array.isArray(data) ? data : data.readings || data.items || []).map(normalizeReading))
    } catch (requestError) { setError(errorMessage(requestError)); setApiRows(null) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [fieldId, from, to])
  const mean = (key) => rows.length ? rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length : 0
  const chartData = rows.slice().sort((a, b) => new Date(timeOf(a)) - new Date(timeOf(b))).map((row) => ({ date: new Date(timeOf(row)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), moisture: row.soil_moisture, temperature: row.temperature }))
  const exportCsv = () => {
    const content = createReadingsCsv(rows, fields)
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `fieldwise-report-${from || 'all'}-to-${to || 'all'}.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return <>
    <PageIntro eyebrow="Data & insights" title="Monitoring reports" description="Filter observations, review summary statistics, and export the selected data as CSV." actions={<button className="button" disabled={!rows.length} onClick={exportCsv}><Download size={14} /> Export CSV</button>} />
    <section className="panel">
      <div className="filters"><div><h2 className="panel-title">Reading report</h2><div className="panel-subtitle">CSV export includes the records shown for the selected filters.</div></div><div className="toolbar"><select className="select" aria-label="Report field filter" value={fieldId} onChange={(e) => { setFieldId(e.target.value); setApiRows(null) }}><option value="all">All fields</option>{fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select><input className="input date-filter" aria-label="Report start date" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setApiRows(null) }} /><input className="input date-filter" aria-label="Report end date" type="date" value={to} onChange={(e) => { setTo(e.target.value); setApiRows(null) }} /><button className="button secondary small" onClick={() => { setFieldId('all'); setFrom(''); setTo(''); setApiRows(null) }}>Reset</button></div></div>
      {error && <Notice tone="error">{error} Showing locally filtered readings where available.</Notice>}
      <div className="grid report-metrics"><ReportStat label="Readings" value={rows.length} /><ReportStat label="Avg. moisture" value={`${mean('soil_moisture').toFixed(1)}%`} /><ReportStat label="Avg. temperature" value={`${mean('temperature').toFixed(1)}°C`} /><ReportStat label="Avg. humidity" value={`${mean('humidity').toFixed(1)}%`} /></div>
      <div className="chart report-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid stroke="#edf0ec" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a097' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9, fill: '#94a097' }} axisLine={false} tickLine={false} /><Tooltip /><Line type="monotone" dataKey="moisture" name="Moisture %" stroke="#438d5c" strokeWidth={2} dot={{ r: 2 }} /><Line type="monotone" dataKey="temperature" name="Temperature °C" stroke="#dc8b55" strokeWidth={2} dot={{ r: 2 }} /></LineChart></ResponsiveContainer></div>
      {loading ? <Loading /> : rows.length ? <div className="table-wrap"><table><thead><tr><th>FIELD</th><th>DATA SOURCE</th><th>MOISTURE</th><th>TEMPERATURE</th><th>HUMIDITY</th><th>SOIL PH</th><th>RAINFALL</th><th>RECORDED AT</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td className="field-name">{row.field_name || fields.find((f) => f.id === row.field_id)?.name || 'Unknown'}</td><td><StatusBadge tone={row.is_demo ? 'amber' : 'green'}>{row.is_demo ? 'DEMO' : 'Recorded'}</StatusBadge></td><td>{row.soil_moisture}%</td><td>{row.temperature}°C</td><td>{row.humidity}%</td><td>{row.soil_ph}</td><td>{row.rainfall} mm</td><td>{new Date(timeOf(row)).toLocaleString()}</td></tr>)}</tbody></table></div> : <Empty title="No readings in this range">Adjust the filters or record field readings to build a report.</Empty>}
    </section>
  </>
}

function ReportStat({ label, value }) {
  return <div className="report-stat"><div className="report-stat-label">{label}</div><div className="report-stat-value">{value}</div></div>
}

export function Settings() {
  const [threshold, setThreshold] = useState(getThreshold)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const save = () => {
    const parsed = Number(threshold)
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) { setError('Enter a threshold between 1 and 100%.'); setSaved(false); return }
    localStorage.setItem(thresholdKey, String(parsed)); setThreshold(parsed); setError(''); setSaved(true); window.setTimeout(() => setSaved(false), 2500)
  }
  return <>
    <PageIntro eyebrow="Preferences" title="Settings" description="Preferences are stored locally in this browser for this demonstration." />
    <section className="panel settings-panel"><div className="panel-header"><div><h2 className="panel-title">Monitoring preferences</h2><div className="panel-subtitle">Adjust how the dashboard interprets field observations.</div></div><SettingsIcon size={18} color="#7d9181" /></div>
      <div className="settings-row"><div><div className="settings-label">Low moisture alert threshold</div><div className="settings-desc">Irrigation guidance triggers when recorded soil moisture is below this value.</div></div><div className="settings-input"><input aria-label="Low moisture threshold percentage" className="input" type="number" min="1" max="100" value={threshold} onChange={(e) => setThreshold(e.target.value)} /><span>%</span></div></div>
      {error && <div className="form-error"><Notice tone="error">{error}</Notice></div>}
      <div className="form-actions"><button className="button" onClick={save}><Check size={14} />Save preferences</button></div>{saved && <div className="section-spacer"><Notice tone="success">Preferences saved in this browser.</Notice></div>}
    </section>
    <section className="panel section-spacer"><div className="panel-header"><div><h2 className="panel-title">Data and limitations</h2><div className="panel-subtitle">Important details for your project demonstration</div></div></div>
      <div className="settings-row"><div><div className="settings-label">Demo readings</div><div className="settings-desc">Initial records are labelled demo data and are not readings from live hardware.</div></div><StatusBadge tone="amber">SIMULATED</StatusBadge></div>
      <div className="settings-row"><div><div className="settings-label">Crop model</div><div className="settings-desc">A basic educational model trained using synthetic examples; it is not agronomically validated.</div></div><StatusBadge tone="gray">EDUCATIONAL</StatusBadge></div>
      <div className="settings-row"><div><div className="settings-label">Pump or sensor hardware</div><div className="settings-desc">No physical sensors, pumps, or valves are connected or controlled by this application.</div></div><StatusBadge tone="gray">NOT CONNECTED</StatusBadge></div>
    </section>
  </>
}

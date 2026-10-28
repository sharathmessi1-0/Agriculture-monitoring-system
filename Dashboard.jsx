import { Activity, Droplets, FlaskConical, Leaf, Thermometer, Wind } from 'lucide-react'
import { CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from 'recharts'
import { MetricCard, PageIntro, StatusBadge, Empty } from '../components/ui'

const colors = ['#4c9560', '#e3ad52', '#d97565']
const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'
const number = (value, digits = 1) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—'

export default function Dashboard({ dashboard = {}, fields = [], readings = [], alerts = [] }) {
  const fieldRows = Array.isArray(fields) ? fields : []
  const readingRows = Array.isArray(readings) ? readings : []
  const alertRows = Array.isArray(alerts) ? alerts : []
  const dashboardLatest = Array.isArray(dashboard.latest_readings) ? dashboard.latest_readings : []
  const latest = new Map()
  const latestSource = dashboardLatest.length ? dashboardLatest.map((reading) => ({
    ...reading,
    temperature: reading.temperature ?? reading.temperature_c,
    humidity: reading.humidity ?? reading.humidity_percent,
    soil_ph: reading.soil_ph,
    rainfall: reading.rainfall ?? reading.rainfall_mm,
  })) : readingRows
  latestSource.forEach((reading) => {
    const key = reading.field_id
    const old = latest.get(key)
    if (!old || new Date(reading.recorded_at || reading.created_at) > new Date(old.recorded_at || old.created_at)) latest.set(key, reading)
  })
  const currentReadings = [...latest.values()]
  const average = (key) => currentReadings.length ? currentReadings.reduce((sum, item) => sum + Number(item[key] || 0), 0) / currentReadings.length : null
  const metrics = dashboard.metrics || dashboard
  const get = (...keys) => {
    for (const key of keys) if (metrics[key] !== undefined && metrics[key] !== null) return metrics[key]
    return undefined
  }
  const historyRows = [dashboard.moisture_history, dashboard.reading_history].find(Array.isArray) || readingRows.slice(0, 40).slice().reverse()
  const history = historyRows.map((row) => ({
    ...row,
    date: row.date || formatDate(row.recorded_at || row.created_at),
    moisture: row.moisture ?? row.soil_moisture,
  }))
  const moistureByField = fieldRows.map((field) => {
    const reading = latest.get(field.id)
    return { field: field.name, moisture: reading?.soil_moisture ?? 0 }
  })
  const healthData = dashboard.crop_health || dashboard.health_statistics
  const health = Array.isArray(healthData) ? healthData : healthData && typeof healthData === 'object'
    ? Object.entries(healthData).map(([name, value]) => ({ name, value }))
    : [
    { name: 'Healthy', value: fieldRows.filter((f) => (latest.get(f.id)?.soil_moisture ?? 50) >= 30).length },
    { name: 'Needs attention', value: fieldRows.filter((f) => (latest.get(f.id)?.soil_moisture ?? 50) < 30).length },
    { name: 'No readings', value: fieldRows.filter((f) => !latest.has(f.id)).length },
  ]
  const openAlerts = alertRows.filter((alert) => !(alert.resolved || alert.is_resolved || alert.status === 'resolved'))
  const fieldLabel = (alert) => alert.field_name || fieldRows.find((field) => field.id === alert.field_id)?.name || 'Unknown field'

  return <>
    <PageIntro eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} title="Good day, Farm Manager" description="Here is the latest overview of your monitored fields." actions={<span className="badge amber">DEMO DATA</span>} />
    <div className="grid metric-grid">
      <MetricCard label="Monitored fields" value={get('total_fields', 'field_count') ?? fieldRows.length} caption="Fields in your workspace" icon={Leaf} />
      <MetricCard label="Avg. soil moisture" value={number(get('average_soil_moisture', 'avg_moisture') ?? average('soil_moisture'))} unit="%" caption="Latest reading per field" icon={Droplets} color="#4383a1" tint="#edf5f8" />
      <MetricCard label="Temperature" value={number(get('average_temperature', 'temperature') ?? average('temperature'))} unit="°C" caption="Average latest reading" icon={Thermometer} color="#bd7d3e" tint="#fbf3e9" />
      <MetricCard label="Humidity" value={number(get('average_humidity', 'humidity') ?? average('humidity'))} unit="%" caption="Average latest reading" icon={Wind} color="#667bb1" tint="#f0f2fa" />
      <MetricCard label="Soil pH" value={number(get('average_ph', 'soil_ph') ?? average('soil_ph'))} caption="Latest readings average" icon={FlaskConical} color="#8c6ba4" tint="#f5f0f8" />
      <MetricCard label="Crop health" value={get('crop_health_status', 'health_status') || (openAlerts.length ? 'Needs review' : 'Good')} caption="Based on available demo readings" icon={Activity} color="#4c9560" tint="#edf6ef" />
      <MetricCard label="Open alerts" value={openAlerts.length} caption="Unresolved monitoring alerts" icon={Activity} color="#c46b57" tint="#fbefec" />
      <MetricCard label="Latest observations" value={readingRows.length} caption="Recorded readings in history" icon={CloudSunIcon} color="#a47c34" tint="#faf5e8" />
    </div>
    <div className="grid dashboard-grid">
      <section className="panel">
        <div className="panel-header"><div><h2 className="panel-title">Soil moisture history</h2><div className="panel-subtitle">Recorded field observations · percentage</div></div><StatusBadge tone="gray">DEMO DATA</StatusBadge></div>
        <div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={history}><CartesianGrid stroke="#edf0ec" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a097' }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a097' }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e8ece6', fontSize: 11 }} /><Line type="monotone" dataKey="moisture" name="Moisture %" stroke="#438d5c" strokeWidth={2.5} dot={{ r: 3, fill: '#438d5c' }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div>
      </section>
      <section className="panel">
        <div className="panel-header"><div><h2 className="panel-title">Crop health overview</h2><div className="panel-subtitle">Status inferred from latest moisture</div></div></div>
        {fieldRows.length ? <><div className="chart small"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={health} dataKey="value" nameKey="name" innerRadius={56} outerRadius={78} paddingAngle={4} stroke="none">{health.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip /><Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer></div><div className="health-summary">{health.map((item, i) => <div className="health-row" key={item.name}><span className="health-dot" style={{ background: colors[i % colors.length] }} /><span className="health-label">{item.name}</span><span className="health-count">{item.value}</span></div>)}</div></> : <Empty title="No field health data">Add fields and readings to see the summary.</Empty>}
      </section>
    </div>
    <div className="grid dashboard-grid section-spacer">
      <section className="panel">
        <div className="panel-header"><div><h2 className="panel-title">Temperature & humidity</h2><div className="panel-subtitle">Recent recorded environmental observations</div></div></div>
        <div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={history}><CartesianGrid stroke="#edf0ec" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a097' }} axisLine={false} tickLine={false} /><YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#94a097' }} axisLine={false} tickLine={false} /><YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#94a097' }} axisLine={false} tickLine={false} /><Tooltip /><Legend wrapperStyle={{ fontSize: 10 }} /><Line yAxisId="left" type="monotone" dataKey="temperature" name="Temperature °C" stroke="#dc8b55" strokeWidth={2} dot={false} /><Line yAxisId="right" type="monotone" dataKey="humidity" name="Humidity %" stroke="#5b87b2" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
      </section>
      <section className="panel">
        <div className="panel-header"><div><h2 className="panel-title">Field-wise moisture</h2><div className="panel-subtitle">Latest available moisture reading</div></div></div>
        {moistureByField.length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={moistureByField} layout="vertical" margin={{ left: 3, right: 12 }}><CartesianGrid stroke="#edf0ec" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a097' }} axisLine={false} tickLine={false} /><YAxis dataKey="field" type="category" width={80} tick={{ fontSize: 9, fill: '#748178' }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="moisture" name="Moisture %" fill="#6ba77a" radius={[0, 5, 5, 0]} barSize={14} /></BarChart></ResponsiveContainer></div> : <Empty title="No fields added">Your field comparison will appear here.</Empty>}
      </section>
    </div>
    <section className="panel section-spacer">
      <div className="panel-header"><div><h2 className="panel-title">Field monitoring summary</h2><div className="panel-subtitle">Latest recorded values by field; missing readings are not treated as live sensor data</div></div></div>
      {fieldRows.length ? <div className="table-wrap"><table><thead><tr><th>FIELD</th><th>CROP</th><th>AREA</th><th>MOISTURE</th><th>TEMPERATURE</th><th>LAST OBSERVED</th><th>STATUS</th></tr></thead><tbody>{fieldRows.map((field) => {
        const reading = latest.get(field.id)
        const moisture = Number(reading?.soil_moisture)
        const tone = !reading ? 'gray' : moisture < 30 ? 'amber' : 'green'
        return <tr key={field.id}><td className="field-name">{field.name}</td><td>{field.crop_type}</td><td>{field.area} ha</td><td>{reading ? `${number(moisture)}%` : '—'}</td><td>{reading ? `${number(reading.temperature)} °C` : '—'}</td><td>{reading ? new Date(reading.recorded_at || reading.created_at).toLocaleString() : 'No observation'}</td><td><StatusBadge tone={tone}>{!reading ? 'No data' : moisture < 30 ? 'Review moisture' : 'Recorded'}</StatusBadge></td></tr>
      })}</tbody></table></div> : <Empty title="No fields added yet">Add fields to see a monitoring summary here.</Empty>}
    </section>
    <section className="panel section-spacer">
      <div className="panel-header"><div><h2 className="panel-title">Recent alerts</h2><div className="panel-subtitle">Items that may need your attention</div></div><a className="text-link" href="/alerts">View all</a></div>
      {openAlerts.length ? <div className="table-wrap"><table><thead><tr><th>ALERT</th><th>FIELD</th><th>SEVERITY</th><th>TIME</th><th>SUGGESTED ACTION</th></tr></thead><tbody>{openAlerts.slice(0, 5).map((alert) => <tr key={alert.id}><td className="field-name">{alert.title || alert.message || alert.alert_type}</td><td>{fieldLabel(alert)}</td><td><StatusBadge tone={alert.severity === 'high' || alert.severity === 'critical' ? 'red' : 'amber'}>{alert.severity || 'medium'}</StatusBadge></td><td>{formatDate(alert.created_at || alert.timestamp)}</td><td>{alert.suggested_action || alert.action || 'Review latest field readings'}</td></tr>)}</tbody></table></div> : <Empty title="All clear">No unresolved alerts at the moment.</Empty>}
    </section>
  </>
}

function CloudSunIcon(props) {
  return <Activity {...props} />
}

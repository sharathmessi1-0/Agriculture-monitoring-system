import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import { Notice, Toast } from './components/ui'
import useToast from './hooks/useToast'
import api, { errorMessage, normalizeReading } from './services/api'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Fields = lazy(() => import('./pages/Fields'))
const Recommendations = lazy(() => import('./pages/Recommendations'))
const Irrigation = lazy(() => import('./pages/Operations').then((module) => ({ default: module.Irrigation })))
const Alerts = lazy(() => import('./pages/Operations').then((module) => ({ default: module.Alerts })))
const Reports = lazy(() => import('./pages/Operations').then((module) => ({ default: module.Reports })))
const Settings = lazy(() => import('./pages/Operations').then((module) => ({ default: module.Settings })))

const list = (value) => Array.isArray(value) ? value : value?.items || value?.fields || value?.readings || value?.alerts || []

export default function App() {
  const [dashboard, setDashboard] = useState({})
  const [fields, setFields] = useState([])
  const [readings, setReadings] = useState([])
  const [alerts, setAlerts] = useState([])
  const [apiConnected, setApiConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [toast, notify] = useToast()

  const refresh = useCallback(async (resources = ['health', 'dashboard', 'fields', 'readings', 'alerts']) => {
    setLoading(true)
    const endpoints = {
      health: '/health', dashboard: '/dashboard', fields: '/fields', readings: '/readings', alerts: '/alerts',
    }
    const requested = resources.filter((resource) => endpoints[resource])
    const results = await Promise.allSettled(requested.map((resource) => api.get(endpoints[resource])))
    const failures = []
    results.forEach((result, index) => {
      const resource = requested[index]
      if (result.status === 'rejected') {
        if (resource === 'health') setApiConnected(false)
        failures.push(`${resource}: ${errorMessage(result.reason)}`)
        return
      }
      const data = result.value.data
      if (resource === 'health') {
        const healthy = ['ok', 'healthy'].includes(String(data?.status).toLowerCase())
        setApiConnected(healthy)
        if (!healthy) failures.push('API health check reported an unexpected status.')
      } else if (resource === 'dashboard') setDashboard(data || {})
      else if (resource === 'fields') setFields(list(data).map((field) => ({ ...field, area: field.area ?? field.area_hectares })))
      else if (resource === 'readings') setReadings(list(data).map(normalizeReading))
      else if (resource === 'alerts') setAlerts(list(data))
    })
    setApiError(failures.length ? failures.join(' ') : '')
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])
  const unresolvedCount = alerts.filter((alert) => !(alert.resolved || alert.is_resolved || alert.status === 'resolved')).length
  return <AppLayout alertCount={unresolvedCount} apiConnected={apiConnected}>
    {apiError && <div className="api-banner"><Notice tone="error"><span>Some API data could not be loaded. Confirm the FastAPI server is running at <code>http://localhost:8000</code>. {apiError}</span><button className="button secondary small" onClick={() => refresh()}>Retry</button></Notice></div>}
    <Suspense fallback={<div className="page-loading">Loading workspace…</div>}>
      <Routes>
        <Route path="/" element={<Dashboard dashboard={dashboard} fields={fields} readings={readings} alerts={alerts} />} />
        <Route path="/fields" element={<Fields fields={fields} readings={readings} loading={loading} refresh={refresh} notify={notify} />} />
        <Route path="/recommendations" element={<Recommendations notify={notify} />} />
        <Route path="/irrigation" element={<Irrigation fields={fields} readings={readings} notify={notify} />} />
        <Route path="/alerts" element={<Alerts alerts={alerts} fields={fields} loading={loading} refresh={refresh} notify={notify} />} />
        <Route path="/reports" element={<Reports fields={fields} readings={readings} />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    <Toast message={toast} />
  </AppLayout>
}

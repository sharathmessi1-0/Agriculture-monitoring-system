import { Check, CircleAlert, LoaderCircle } from 'lucide-react'

export function PageIntro({ eyebrow, title, description, actions }) {
  return <div className="page-intro"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1 className="page-title">{title}</h1><p className="page-description">{description}</p></div>{actions}</div>
}

export function Notice({ children, tone = 'info' }) {
  const Icon = tone === 'error' ? CircleAlert : tone === 'success' ? Check : CircleAlert
  return <div className={`notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}><Icon size={15} />{children}</div>
}

export function Loading({ label = 'Loading data…' }) {
  return <div className="empty-state"><LoaderCircle className="spin" size={18} /><div>{label}</div></div>
}

export function Empty({ title = 'Nothing to show yet', children }) {
  return <div className="empty-state"><strong>{title}</strong>{children}</div>
}

export function MetricCard({ label, value, unit, caption, icon: Icon, color = '#27734c', tint = '#edf6ef' }) {
  return <article className="metric-card"><div className="metric-top"><span className="metric-label">{label}</span><span className="metric-icon" style={{ background: tint, color }}><Icon size={17} /></span></div><div className="metric-value">{value ?? '—'}{unit && <span className="metric-unit">{unit}</span>}</div><div className="metric-caption">{caption}</div></article>
}

export function StatusBadge({ children, tone = 'gray' }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>
}

export function Toast({ message }) {
  if (!message) return null
  return <div className="toast" role="status"><Check size={16} />{message}</div>
}

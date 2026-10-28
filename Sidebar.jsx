import { NavLink } from 'react-router-dom'
import { Activity, Bell, ChartNoAxesCombined, CloudSun, Droplets, Leaf, LayoutDashboard, Settings, Sprout, X } from 'lucide-react'

const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/fields', label: 'Field Monitoring', icon: Activity },
  { to: '/recommendations', label: 'Crop Recommendation', icon: Sprout },
  { to: '/irrigation', label: 'Irrigation Management', icon: Droplets },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/reports', label: 'Reports', icon: ChartNoAxesCombined },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {open && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Leaf size={21} /></div>
          <div><div className="brand-title">Fieldwise</div><div className="brand-subtitle">Smart agriculture</div></div>
          <button className="sidebar-close" aria-label="Close navigation" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="nav-label">Workspace</div>
        <nav className="nav-links" aria-label="Main navigation">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onClose} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-note"><strong><CloudSun size={13} /> DEMO ENVIRONMENT</strong>Sample readings are for educational demonstration only and are not live sensor data.</div>
          <div className="user-chip"><div className="avatar">FM</div><div><div className="user-name">Farm Manager</div><div className="user-role">Local workspace</div></div></div>
        </div>
      </aside>
    </>
  )
}

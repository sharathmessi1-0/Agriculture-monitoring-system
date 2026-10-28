import { useState } from 'react'
import { Menu, Bell } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'

const titles = {
  '/': ['Overview', 'Your farm at a glance'],
  '/fields': ['Field Monitoring', 'Manage your fields and record readings'],
  '/recommendations': ['Crop Recommendation', 'Explore an educational machine-learning recommendation'],
  '/irrigation': ['Irrigation Management', 'Rule-based guidance from recorded moisture readings'],
  '/alerts': ['Alerts', 'Review and resolve field monitoring alerts'],
  '/reports': ['Reports', 'Explore and export filtered monitoring data'],
  '/settings': ['Settings', 'Configure local monitoring preferences'],
}

export default function AppLayout({ children, alertCount = 0, apiConnected = false }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const [title, subtitle] = titles[location.pathname] || titles['/']
  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={18} /></button>
            <div><div className="page-heading">{title}</div><div className="page-subheading">{subtitle}</div></div>
          </div>
          <div className="topbar-actions">
            <div className="status-pill"><span className={`status-dot ${apiConnected ? '' : 'status-offline'}`} /> Demo data · API {apiConnected ? 'connected' : 'offline'}</div>
            <button className="icon-button" aria-label={`${alertCount} unresolved alerts`} title={`${alertCount} unresolved alerts`} onClick={() => navigate('/alerts')}>
              <Bell size={16} />{alertCount > 0 && <span className="notification-dot" />}
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}

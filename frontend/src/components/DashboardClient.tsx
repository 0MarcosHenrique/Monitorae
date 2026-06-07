'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AuthPanel } from '@/components/AuthPanel'
import { EndpointActions } from '@/components/EndpointActions'
import { EndpointEditForm } from '@/components/EndpointEditForm'
import { EndpointForm } from '@/components/EndpointForm'
import { RunCheckButton } from '@/components/RunCheckButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { authChangedEvent, endpointsChangedEvent, getAuthHeaders, getAuthToken } from '@/lib/authToken'

export type HealthCheck = {
  statusCode: number | null
  latency: number
  isUp: boolean
  checkedAt: string
}

export type Endpoint = {
  id: string
  name: string
  url: string
  method: string
  expectedStatus: number[]
  expectedBodyContains: string | null
  interval: number
  timeout: number
  currentStatus: 'UP' | 'DOWN' | 'DEGRADED' | null
  lastCheckedAt: string | null
  healthChecks: HealthCheck[]
}

type ApiResponse = {
  success: boolean
  data: Endpoint[]
  error: unknown
}

type DashboardClientProps = {
  initialEndpoints: Endpoint[]
  initialError: string | null
}

const apiBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001'

function formatDate(value: string | null) {
  if (!value) {
    return 'Not checked yet'
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getLatestCheck(endpoint: Endpoint) {
  return endpoint.healthChecks[0]
}

function formatRelativeTime(value: string | null) {
  if (!value) {
    return 'Not checked yet'
  }

  const diffMs = Date.now() - new Date(value).getTime()
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000))

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`
  }

  const diffHours = Math.round(diffMinutes / 60)

  return `${diffHours} h ago`
}

function buildSparkline(endpoints: Endpoint[], fallback: number) {
  const values = endpoints
    .map((endpoint) => getLatestCheck(endpoint))
    .filter((check): check is HealthCheck => Boolean(check))
    .map((check) => check.latency)

  const source = values.length > 0 ? values : [fallback || 1]
  const max = Math.max(...source, 1)
  const points = Array.from({ length: 12 }, (_, index) => source[index % source.length])

  return points.map((value) => Math.max((value / max) * 100, 12))
}

export function DashboardClient({ initialEndpoints, initialError }: DashboardClientProps) {
  const [endpoints, setEndpoints] = useState(initialEndpoints)
  const [error, setError] = useState(initialError)
  const [isAuthenticatedView, setIsAuthenticatedView] = useState(false)
  const [editingEndpointId, setEditingEndpointId] = useState<string | null>(null)

  const loadEndpoints = useCallback(async () => {
    const token = getAuthToken()
    setIsAuthenticatedView(Boolean(token))

    try {
      const response = await fetch(`${apiBaseUrl}/api/endpoints`, {
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        setError(`API returned ${response.status}`)
        setEndpoints([])
        return
      }

      const payload = (await response.json()) as ApiResponse

      if (!payload.success) {
        setError('API response was not successful')
        setEndpoints([])
        return
      }

      setEndpoints(payload.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to API')
      setEndpoints([])
    }
  }, [])

  useEffect(() => {
    setIsAuthenticatedView(Boolean(getAuthToken()))

    const handleRefresh = () => {
      void loadEndpoints()
    }

    window.addEventListener(authChangedEvent, handleRefresh)
    window.addEventListener(endpointsChangedEvent, handleRefresh)

    return () => {
      window.removeEventListener(authChangedEvent, handleRefresh)
      window.removeEventListener(endpointsChangedEvent, handleRefresh)
    }
  }, [loadEndpoints])

  const summary = useMemo(() => {
    const checks = endpoints.flatMap((endpoint) => endpoint.healthChecks)
    const activeChecks = checks.filter((check) => check.isUp).length
    const uptime = checks.length > 0 ? (activeChecks / checks.length) * 100 : 0

    return {
      upCount: endpoints.filter((endpoint) => endpoint.currentStatus === 'UP').length,
      downCount: endpoints.filter((endpoint) => endpoint.currentStatus === 'DOWN').length,
      pendingCount: endpoints.filter((endpoint) => !endpoint.currentStatus).length,
      uptime,
      averageLatency:
        checks.length > 0
          ? Math.round(checks.reduce((sum, check) => sum + check.latency, 0) / checks.length)
          : 0,
    }
  }, [endpoints])

  const responseSparkline = useMemo(() => buildSparkline(endpoints, summary.averageLatency), [endpoints, summary.averageLatency])
  const uptimeSparkline = useMemo(() => {
    const base = summary.uptime || 100

    return Array.from({ length: 12 }, (_, index) => Math.max(Math.min(base - (index % 4) * 0.25, 100), 96))
  }, [summary.uptime])
  const recentActivity = endpoints
    .filter((endpoint) => endpoint.lastCheckedAt)
    .slice(0, 4)

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark">M</span>
          <strong>Monitorae</strong>
        </Link>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          <a className="active" href="#overview"><span>⌘</span>Overview</a>
          <a href="#monitors"><span>◉</span>Endpoints</a>
          <a href="#incidents"><span>◇</span>Incidents</a>
          <a href="#activity"><span>↗</span>Alerts</a>
          <a href="#new-monitor"><span>＋</span>New Monitor</a>
        </nav>

        <div className="sidebar-divider" />

        <nav className="sidebar-nav secondary" aria-label="Secondary navigation">
          <a href="#account"><span>◎</span>Account</a>
          <a href="#monitors"><span>☷</span>Monitor list</a>
        </nav>

        <div className="plan-card">
          <div>
            <span>Plan</span>
            <strong>Local</strong>
          </div>
          <div>
            <span>Monitors</span>
            <strong>{endpoints.length} / 20</strong>
          </div>
        </div>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <div>
            <h1>Overview</h1>
            <p>Real-time overview of your API monitors and system health.</p>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <a className="primary-button" href="#new-monitor">+ New Monitor</a>
          </div>
        </header>

        <div id="account">
          <AuthPanel />
        </div>

        {error ? <div className="error-box">Backend connection issue: {error}</div> : null}

        <section className="dashboard" id="overview">
          <div className="status-strip">
            <span className={`status-dot ${error ? 'warn' : 'ok'}`} />
            {error ? 'API unavailable' : isAuthenticatedView ? 'Account data' : 'Demo data'}
          </div>

          <div className="metric-grid" aria-label="Monitoring summary">
          <div className="metric">
            <span><i className="metric-icon green">✓</i>Active Monitors</span>
            <strong>{endpoints.length}</strong>
            <small>{summary.upCount} online</small>
          </div>
          <div className="metric">
            <span><i className="metric-icon violet">◷</i>Avg. Response Time</span>
            <strong>{summary.averageLatency}ms</strong>
            <small>{summary.pendingCount} waiting checks</small>
          </div>
          <div className="metric" id="incidents">
            <span><i className="metric-icon rose">!</i>Incidents</span>
            <strong>{summary.downCount}</strong>
            <small>{summary.downCount === 0 ? 'No incidents' : 'Needs attention'}</small>
          </div>
          <div className="metric">
            <span><i className="metric-icon blue">↟</i>Uptime</span>
            <strong>{summary.uptime.toFixed(2)}%</strong>
            <small>from latest checks</small>
          </div>
        </div>

          <div className="overview-grid">
            <div className="panel chart-panel">
              <div className="panel-header">
                <div>
                  <h2>Uptime Overview</h2>
                  <p>Current monitor health sample</p>
                </div>
                <span className="select-pill">30 days</span>
              </div>
              <div className="line-chart uptime-chart">
                {uptimeSparkline.map((point, index) => (
                  <span
                    key={`uptime-${index}`}
                    style={{ height: `${point}%` }}
                    title={`${point.toFixed(2)}% uptime`}
                  />
                ))}
              </div>
            </div>

            <div className="panel chart-panel">
              <div className="panel-header">
                <div>
                  <h2>Response Time</h2>
                  <p>Latest endpoint response sample</p>
                </div>
                <strong className="chart-value">{summary.averageLatency}ms</strong>
              </div>
              <div className="line-chart response-chart">
                {responseSparkline.map((point, index) => (
                  <span key={`response-${index}`} style={{ height: `${point}%` }} title={`${Math.round(point)}%`} />
                ))}
              </div>
            </div>
          </div>

          <div className="content-grid">
            <div className="panel" id="monitors">
              <div className="panel-header">
                <div>
                  <h2>Monitors</h2>
                  <p>{summary.pendingCount} waiting for the first check</p>
                </div>
              </div>

              {endpoints.length === 0 ? (
                <div className="empty-state">No active endpoints found.</div>
              ) : (
                <div className="table-scroll">
                  <table className="endpoint-table">
                    <thead>
                      <tr>
                        <th>Monitor</th>
                        <th>Status</th>
                        <th>Response Time</th>
                        <th>Uptime</th>
                        <th>Last Check</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {endpoints.map((endpoint) => {
                        const latestCheck = getLatestCheck(endpoint)
                        const status = endpoint.currentStatus?.toLowerCase() || 'pending'

                        return (
                          <Fragment key={endpoint.id}>
                            <tr key={endpoint.id}>
                              <td>
                                <Link className="endpoint-name" href={`/endpoints/${endpoint.id}`}>
                                  <span className="endpoint-avatar">{endpoint.name.slice(0, 1).toUpperCase()}</span>
                                  <span>
                                    {endpoint.name}
                                    <small>{endpoint.url}</small>
                                  </span>
                                </Link>
                              </td>
                              <td>
                                <span className={`badge ${status}`}>{endpoint.currentStatus || 'PENDING'}</span>
                              </td>
                              <td>{latestCheck ? `${Math.round(latestCheck.latency)}ms` : '-'}</td>
                              <td>
                                <div className="uptime-cell">
                                  <span>{latestCheck?.isUp ? '100%' : '0%'}</span>
                                  <i className={latestCheck?.isUp ? 'up' : 'down'} />
                                </div>
                              </td>
                              <td>{formatRelativeTime(endpoint.lastCheckedAt)}</td>
                              <td>
                                <div className="row-actions">
                                  <Link className="secondary-button" href={`/endpoints/${endpoint.id}`}>
                                    View
                                  </Link>
                                  <RunCheckButton endpointId={endpoint.id} />
                                  <button
                                    className="secondary-button"
                                    onClick={() => setEditingEndpointId(endpoint.id)}
                                    type="button"
                                  >
                                    Edit
                                  </button>
                                  <EndpointActions endpointId={endpoint.id} endpointName={endpoint.name} />
                                </div>
                              </td>
                            </tr>
                            {editingEndpointId === endpoint.id ? (
                              <tr key={`${endpoint.id}-edit`}>
                                <td colSpan={6}>
                                  <EndpointEditForm
                                    endpoint={endpoint}
                                    onCancel={() => setEditingEndpointId(null)}
                                    onSaved={() => {
                                      setEditingEndpointId(null)
                                      void loadEndpoints()
                                    }}
                                  />
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <aside className="activity-panel panel" id="activity">
              <div className="panel-header">
                <div>
                  <h2>Recent Activity</h2>
                  <p>Latest monitor checks</p>
                </div>
              </div>
              <div className="activity-list">
                {recentActivity.length === 0 ? (
                  <p>No activity yet.</p>
                ) : recentActivity.map((endpoint) => {
                  const latestCheck = getLatestCheck(endpoint)

                  return (
                    <Link className="activity-item" href={`/endpoints/${endpoint.id}`} key={endpoint.id}>
                      <span className={latestCheck?.isUp ? 'activity-icon up' : 'activity-icon down'}>
                        {latestCheck?.isUp ? '↑' : '↓'}
                      </span>
                      <span>
                        <strong>{endpoint.name}</strong>
                        <small>{latestCheck?.isUp ? 'Check successful' : 'Check failed'}</small>
                      </span>
                      <em>{formatRelativeTime(endpoint.lastCheckedAt)}</em>
                    </Link>
                  )
                })}
              </div>
            </aside>
          </div>

          <div className="panel" id="new-monitor">
            <div className="panel-header">
              <div>
                <h2>New Monitor</h2>
                <p>Create a monitor and schedule its first checks automatically</p>
              </div>
            </div>
            <EndpointForm />
          </div>
        </section>
      </div>
    </div>
  )
}

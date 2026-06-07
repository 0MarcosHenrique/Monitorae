'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AuthPanel } from '@/components/AuthPanel'
import { EndpointActions } from '@/components/EndpointActions'
import { EndpointEditForm } from '@/components/EndpointEditForm'
import { EndpointForm } from '@/components/EndpointForm'
import { RunCheckButton } from '@/components/RunCheckButton'
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

    return {
      upCount: endpoints.filter((endpoint) => endpoint.currentStatus === 'UP').length,
      downCount: endpoints.filter((endpoint) => endpoint.currentStatus === 'DOWN').length,
      pendingCount: endpoints.filter((endpoint) => !endpoint.currentStatus).length,
      averageLatency:
        checks.length > 0
          ? Math.round(checks.reduce((sum, check) => sum + check.latency, 0) / checks.length)
          : 0,
    }
  }, [endpoints])

  return (
    <>
      <header className="app-header">
        <div>
          <p className="eyebrow">API Monitoring</p>
          <h1>Monitorae</h1>
          <p className="subtitle">
            Track endpoint availability, scheduled checks and recent latency from a focused operational dashboard.
          </p>
        </div>
        <div className="refresh-pill">
          <span className={`status-dot ${error ? 'warn' : 'ok'}`} />
          {error ? 'API unavailable' : isAuthenticatedView ? 'Account data' : 'Demo data'}
        </div>
      </header>

      {error ? <div className="error-box">Backend connection issue: {error}</div> : null}

      <section className="dashboard">
        <AuthPanel />

        <div className="metric-grid" aria-label="Monitoring summary">
          <div className="metric">
            <span>Total endpoints</span>
            <strong>{endpoints.length}</strong>
          </div>
          <div className="metric">
            <span>Up</span>
            <strong>{summary.upCount}</strong>
          </div>
          <div className="metric">
            <span>Down</span>
            <strong>{summary.downCount}</strong>
          </div>
          <div className="metric">
            <span>Avg latency</span>
            <strong>{summary.averageLatency}ms</strong>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Add endpoint</h2>
              <p>Create a monitor and schedule its first checks automatically</p>
            </div>
          </div>
          <EndpointForm />
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Endpoints</h2>
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
                    <th>Endpoint</th>
                    <th>Status</th>
                    <th>Last status code</th>
                    <th>Latency</th>
                    <th>Interval</th>
                    <th>Last check</th>
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
                              {endpoint.method} {endpoint.name}
                            </Link>
                            <span className="endpoint-url">{endpoint.url}</span>
                          </td>
                          <td>
                            <span className={`badge ${status}`}>{endpoint.currentStatus || 'PENDING'}</span>
                          </td>
                          <td>{latestCheck?.statusCode || '-'}</td>
                          <td>{latestCheck ? `${Math.round(latestCheck.latency)}ms` : '-'}</td>
                          <td>{endpoint.interval}s</td>
                          <td>{formatDate(endpoint.lastCheckedAt)}</td>
                          <td>
                            <div className="row-actions stacked">
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
                            <td colSpan={7}>
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
      </section>
    </>
  )
}

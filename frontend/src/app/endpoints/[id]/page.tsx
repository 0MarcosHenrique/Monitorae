import { RunCheckButton } from '@/components/RunCheckButton'
import Link from 'next/link'

type HealthCheck = {
  id: string
  statusCode: number | null
  latency: number
  isUp: boolean
  errorMessage: string | null
  checkedAt: string
}

type Alert = {
  id: string
  type: string
  channel: string
  message: string
  sent: boolean
  createdAt: string
}

type Incident = {
  id: string
  startedAt: string
  resolvedAt: string | null
  errorCode: number | null
  errorMessage: string | null
  duration: number | null
}

type Endpoint = {
  id: string
  name: string
  url: string
  method: string
  interval: number
  timeout: number
  currentStatus: 'UP' | 'DOWN' | 'DEGRADED' | null
  lastCheckedAt: string | null
  healthChecks: HealthCheck[]
  alerts: Alert[]
  incidents: Incident[]
}

type ApiResponse = {
  success: boolean
  data: Endpoint
  error: unknown
}

const apiBaseUrl =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001'

async function getEndpoint(id: string) {
  try {
    const response = await fetch(`${apiBaseUrl}/api/endpoints/${id}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return { endpoint: null, error: `API returned ${response.status}` }
    }

    const payload = (await response.json()) as ApiResponse

    if (!payload.success) {
      return { endpoint: null, error: 'API response was not successful' }
    }

    return { endpoint: payload.data, error: null }
  } catch (error) {
    return {
      endpoint: null,
      error: error instanceof Error ? error.message : 'Could not connect to API',
    }
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Not checked yet'
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getPercentile(values: number[], percentile: number) {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil((percentile / 100) * sorted.length) - 1)

  return sorted[index]
}

function formatIncidentDuration(seconds: number | null) {
  if (!seconds) {
    return 'Still open'
  }

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}

export default async function EndpointDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { endpoint, error } = await getEndpoint(id)

  if (!endpoint) {
    return (
      <main className="page-shell">
        <div className="detail-shell">
          <Link className="back-link" href="/">
            Back to dashboard
          </Link>
          <div className="error-box">Could not load endpoint: {error}</div>
        </div>
      </main>
    )
  }

  const latestChecks = endpoint.healthChecks.slice(0, 12).reverse()
  const maxLatency = Math.max(...latestChecks.map((check) => check.latency), 1)
  const latencies = endpoint.healthChecks.map((check) => check.latency)
  const averageLatency =
    latencies.length > 0 ? Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length) : 0
  const p95Latency = Math.round(getPercentile(latencies, 95))
  const failureCount = endpoint.healthChecks.filter((check) => !check.isUp).length
  const latestCheck = endpoint.healthChecks[0]
  const uptime =
    endpoint.healthChecks.length > 0
      ? Math.round((endpoint.healthChecks.filter((check) => check.isUp).length / endpoint.healthChecks.length) * 100)
      : 0

  return (
    <main className="page-shell">
      <div className="detail-shell">
        <Link className="back-link" href="/">
          Back to dashboard
        </Link>

        <header className="detail-header">
          <div>
            <p className="eyebrow">{endpoint.method}</p>
            <h1>{endpoint.name}</h1>
            <p className="subtitle">{endpoint.url}</p>
          </div>
          <RunCheckButton endpointId={endpoint.id} />
        </header>

        <section className="metric-grid">
          <div className="metric">
            <span>Status</span>
            <strong className={`status-text ${(endpoint.currentStatus || 'PENDING').toLowerCase()}`}>
              {endpoint.currentStatus || 'PENDING'}
            </strong>
          </div>
          <div className="metric">
            <span>Uptime from recent checks</span>
            <strong>{uptime}%</strong>
          </div>
          <div className="metric">
            <span>Average latency</span>
            <strong>{averageLatency}ms</strong>
          </div>
          <div className="metric">
            <span>P95 latency</span>
            <strong>{p95Latency}ms</strong>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Latency trend</h2>
              <p>Last {latestChecks.length} checks, scaled against {Math.round(maxLatency)}ms max</p>
            </div>
            <div className="chart-summary">
              <span>{failureCount} failed</span>
              <span>{endpoint.interval}s interval</span>
              <span>{endpoint.timeout}ms timeout</span>
            </div>
          </div>
          <div className="latency-chart" aria-label="Recent latency chart">
            {latestChecks.length === 0 ? (
              <div className="empty-state">No checks yet.</div>
            ) : latestChecks.map((check) => (
              <div
                className="latency-bar-wrap"
                key={check.id}
                title={`${Math.round(check.latency)}ms at ${formatTime(check.checkedAt)}`}
              >
                <div
                  className={`latency-bar ${check.isUp ? 'up' : 'down'}`}
                  style={{ height: `${Math.max((check.latency / maxLatency) * 100, 8)}%` }}
                />
                <span>{Math.round(check.latency)}ms</span>
                <small>{formatTime(check.checkedAt)}</small>
              </div>
            ))}
          </div>
          {latestChecks.length > 0 ? (
            <div className="status-timeline" aria-label="Recent status timeline">
              {latestChecks.map((check) => (
                <span
                  className={check.isUp ? 'up' : 'down'}
                  key={`${check.id}-status`}
                  title={`${check.isUp ? 'Up' : 'Down'} - ${formatDate(check.checkedAt)}`}
                />
              ))}
            </div>
          ) : null}
        </section>

        <section className="detail-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Recent checks</h2>
                <p>Latest result: {latestCheck ? `${Math.round(latestCheck.latency)}ms` : 'not checked yet'}</p>
              </div>
            </div>
            <div className="list-panel">
              {endpoint.healthChecks.length === 0 ? <p>No checks yet.</p> : endpoint.healthChecks.map((check) => (
                <div className="list-row" key={check.id}>
                  <div className="row-heading">
                    <strong>{check.statusCode || 'FAILED'} - {Math.round(check.latency)}ms</strong>
                    <span className={`mini-badge ${check.isUp ? 'up' : 'down'}`}>
                      {check.isUp ? 'UP' : 'DOWN'}
                    </span>
                  </div>
                  <span>{formatDate(check.checkedAt)}</span>
                  {check.errorMessage ? <p>{check.errorMessage}</p> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Alerts</h2>
                <p>Created from status changes</p>
              </div>
            </div>
            <div className="list-panel">
              {endpoint.alerts.length === 0 ? <p>No alerts yet.</p> : endpoint.alerts.map((alert) => (
                <div className="list-row" key={alert.id}>
                  <div className="row-heading">
                    <strong>{alert.type} via {alert.channel}</strong>
                    <span className={`mini-badge ${alert.sent ? 'up' : 'pending'}`}>
                      {alert.sent ? 'SENT' : 'PENDING'}
                    </span>
                  </div>
                  <span>{alert.sent ? 'Sent' : 'Pending'} - {formatDate(alert.createdAt)}</span>
                  <p>{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Incidents</h2>
              <p>Open and resolved downtime windows</p>
            </div>
          </div>
          <div className="list-panel">
            {endpoint.incidents.length === 0 ? <p>No incidents yet.</p> : endpoint.incidents.map((incident) => (
              <div className="list-row" key={incident.id}>
                <div className="row-heading">
                  <strong>{incident.resolvedAt ? 'Resolved' : 'Open'} incident</strong>
                  <span className={`mini-badge ${incident.resolvedAt ? 'up' : 'down'}`}>
                    {incident.resolvedAt ? 'RESOLVED' : 'OPEN'}
                  </span>
                </div>
                <span>{formatDate(incident.startedAt)} - {formatIncidentDuration(incident.duration)}</span>
                {incident.errorMessage ? <p>{incident.errorMessage}</p> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

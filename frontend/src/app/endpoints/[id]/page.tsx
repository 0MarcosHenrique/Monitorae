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
            <strong>{endpoint.currentStatus || 'PENDING'}</strong>
          </div>
          <div className="metric">
            <span>Uptime</span>
            <strong>{uptime}%</strong>
          </div>
          <div className="metric">
            <span>Interval</span>
            <strong>{endpoint.interval}s</strong>
          </div>
          <div className="metric">
            <span>Last check</span>
            <strong className="small-metric">{formatDate(endpoint.lastCheckedAt)}</strong>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Latency</h2>
              <p>Last {latestChecks.length} checks</p>
            </div>
          </div>
          <div className="latency-chart">
            {latestChecks.length === 0 ? (
              <div className="empty-state">No checks yet.</div>
            ) : latestChecks.map((check) => (
              <div className="latency-bar-wrap" key={check.id} title={`${Math.round(check.latency)}ms`}>
                <div
                  className={`latency-bar ${check.isUp ? 'up' : 'down'}`}
                  style={{ height: `${Math.max((check.latency / maxLatency) * 100, 8)}%` }}
                />
                <span>{Math.round(check.latency)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Recent checks</h2>
                <p>Status code, latency and error message</p>
              </div>
            </div>
            <div className="list-panel">
              {endpoint.healthChecks.length === 0 ? <p>No checks yet.</p> : endpoint.healthChecks.map((check) => (
                <div className="list-row" key={check.id}>
                  <strong>{check.statusCode || 'FAILED'} - {Math.round(check.latency)}ms</strong>
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
                  <strong>{alert.type} via {alert.channel}</strong>
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
                <strong>{incident.resolvedAt ? 'Resolved' : 'Open'} incident</strong>
                <span>
                  {formatDate(incident.startedAt)}
                  {incident.duration ? ` - ${incident.duration}s` : ''}
                </span>
                {incident.errorMessage ? <p>{incident.errorMessage}</p> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

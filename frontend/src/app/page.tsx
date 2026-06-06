type HealthCheck = {
  statusCode: number | null
  latency: number
  isUp: boolean
  checkedAt: string
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
}

type ApiResponse = {
  success: boolean
  data: Endpoint[]
  error: unknown
}

const apiBaseUrl =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001'

async function getEndpoints() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/endpoints`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        endpoints: [],
        error: `API returned ${response.status}`,
      }
    }

    const payload = (await response.json()) as ApiResponse

    if (!payload.success) {
      return {
        endpoints: [],
        error: 'API response was not successful',
      }
    }

    return {
      endpoints: payload.data,
      error: null,
    }
  } catch (error) {
    return {
      endpoints: [],
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

function getLatestCheck(endpoint: Endpoint) {
  return endpoint.healthChecks[0]
}

export default async function Home() {
  const { endpoints, error } = await getEndpoints()
  const upCount = endpoints.filter((endpoint) => endpoint.currentStatus === 'UP').length
  const downCount = endpoints.filter((endpoint) => endpoint.currentStatus === 'DOWN').length
  const pendingCount = endpoints.filter((endpoint) => !endpoint.currentStatus).length
  const checks = endpoints.flatMap((endpoint) => endpoint.healthChecks)
  const averageLatency =
    checks.length > 0
      ? Math.round(checks.reduce((sum, check) => sum + check.latency, 0) / checks.length)
      : 0

  return (
    <main className="page-shell">
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
          {error ? 'API unavailable' : 'Live data'}
        </div>
      </header>

      {error ? <div className="error-box">Backend connection issue: {error}</div> : null}

      <section className="dashboard">
        <div className="metric-grid" aria-label="Monitoring summary">
          <div className="metric">
            <span>Total endpoints</span>
            <strong>{endpoints.length}</strong>
          </div>
          <div className="metric">
            <span>Up</span>
            <strong>{upCount}</strong>
          </div>
          <div className="metric">
            <span>Down</span>
            <strong>{downCount}</strong>
          </div>
          <div className="metric">
            <span>Avg latency</span>
            <strong>{averageLatency}ms</strong>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Endpoints</h2>
              <p>{pendingCount} waiting for the first check</p>
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
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((endpoint) => {
                    const latestCheck = getLatestCheck(endpoint)
                    const status = endpoint.currentStatus?.toLowerCase() || 'pending'

                    return (
                      <tr key={endpoint.id}>
                        <td>
                          <span className="endpoint-name">
                            {endpoint.method} {endpoint.name}
                          </span>
                          <span className="endpoint-url">{endpoint.url}</span>
                        </td>
                        <td>
                          <span className={`badge ${status}`}>{endpoint.currentStatus || 'PENDING'}</span>
                        </td>
                        <td>{latestCheck?.statusCode || '-'}</td>
                        <td>{latestCheck ? `${Math.round(latestCheck.latency)}ms` : '-'}</td>
                        <td>{endpoint.interval}s</td>
                        <td>{formatDate(endpoint.lastCheckedAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

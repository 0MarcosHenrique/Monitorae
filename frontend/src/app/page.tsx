import { DashboardClient, Endpoint } from '@/components/DashboardClient'

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

export default async function Home() {
  const { endpoints, error } = await getEndpoints()

  return (
    <main className="page-shell">
      <DashboardClient initialEndpoints={endpoints} initialError={error} />
    </main>
  )
}

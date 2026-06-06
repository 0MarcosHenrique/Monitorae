'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const apiBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001'

type EndpointActionsProps = {
  endpointId: string
  endpointName: string
}

export function EndpointActions({ endpointId, endpointName }: EndpointActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleDelete() {
    const confirmed = window.confirm(`Remove monitor "${endpointName}"?`)

    if (!confirmed) {
      return
    }

    setError('')

    startTransition(async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/endpoints/${endpointId}`, {
          method: 'DELETE',
        })
        const body = await response.json()

        if (!response.ok || !body.success) {
          setError('Could not remove')
          return
        }

        router.refresh()
      } catch {
        setError('Could not remove')
      }
    })
  }

  return (
    <div className="row-actions">
      <button className="danger-button" disabled={isPending} onClick={handleDelete} type="button">
        {isPending ? 'Removing...' : 'Remove'}
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const apiBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001'

type RunCheckButtonProps = {
  endpointId: string
}

export function RunCheckButton({ endpointId }: RunCheckButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleRunCheck() {
    setError('')

    startTransition(async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/endpoints/${endpointId}/check`, {
          method: 'POST',
        })
        const body = await response.json()

        if (!response.ok || !body.success) {
          setError('Check failed')
          return
        }

        router.refresh()
      } catch {
        setError('Check failed')
      }
    })
  }

  return (
    <div className="row-actions">
      <button className="secondary-button" disabled={isPending} onClick={handleRunCheck} type="button">
        {isPending ? 'Checking...' : 'Run check'}
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  )
}

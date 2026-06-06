'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const apiBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001'

type SubmitState = {
  type: 'idle' | 'success' | 'error'
  message: string
}

function parseStatusCodes(value: string) {
  return value
    .split(',')
    .map((status) => Number(status.trim()))
    .filter((status) => Number.isInteger(status))
}

export function EndpointForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<SubmitState>({
    type: 'idle',
    message: '',
  })
  const [method, setMethod] = useState('GET')
  const [expectedStatus, setExpectedStatus] = useState('200')

  const canSubmit = useMemo(() => {
    return parseStatusCodes(expectedStatus).length > 0 && !isPending
  }, [expectedStatus, isPending])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const statusCodes = parseStatusCodes(expectedStatus)

    if (statusCodes.length === 0) {
      setState({
        type: 'error',
        message: 'Add at least one expected HTTP status.',
      })
      return
    }

    const payload = {
      name: String(formData.get('name')),
      url: String(formData.get('url')),
      method,
      expectedStatus: statusCodes,
      interval: Number(formData.get('interval')),
      timeout: Number(formData.get('timeout')),
      expectedBodyContains: String(formData.get('expectedBodyContains') || '') || undefined,
    }

    setState({ type: 'idle', message: '' })

    startTransition(async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/endpoints`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        const body = await response.json()

        if (!response.ok || !body.success) {
          setState({
            type: 'error',
            message: 'Could not create endpoint. Check the fields and try again.',
          })
          return
        }

        form.reset()
        setMethod('GET')
        setExpectedStatus('200')
        setState({
          type: 'success',
          message: 'Endpoint created and scheduled.',
        })
        router.refresh()
      } catch (error) {
        setState({
          type: 'error',
          message: error instanceof Error ? error.message : 'Could not connect to the API.',
        })
      }
    })
  }

  return (
    <form className="endpoint-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          <span>Name</span>
          <input name="name" minLength={3} maxLength={100} placeholder="GitHub API" required />
        </label>

        <label className="field-wide">
          <span>URL</span>
          <input name="url" type="url" placeholder="https://api.github.com" required />
        </label>

        <label>
          <span>Method</span>
          <select name="method" value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>
        </label>

        <label>
          <span>Expected status</span>
          <input
            name="expectedStatus"
            inputMode="numeric"
            onChange={(event) => setExpectedStatus(event.target.value)}
            placeholder="200, 201"
            required
            value={expectedStatus}
          />
        </label>

        <label>
          <span>Interval</span>
          <input name="interval" type="number" min={10} step={5} defaultValue={60} required />
        </label>

        <label>
          <span>Timeout</span>
          <input name="timeout" type="number" min={1000} step={500} defaultValue={10000} required />
        </label>

        <label className="field-wide">
          <span>Body contains</span>
          <input name="expectedBodyContains" placeholder="Optional response text" />
        </label>
      </div>

      <div className="form-footer">
        <button type="submit" disabled={!canSubmit}>
          {isPending ? 'Creating...' : 'Add endpoint'}
        </button>
        {state.message ? <p className={`form-message ${state.type}`}>{state.message}</p> : null}
      </div>
    </form>
  )
}

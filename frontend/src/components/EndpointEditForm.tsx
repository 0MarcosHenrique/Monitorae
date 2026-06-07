'use client'

import { FormEvent, useState, useTransition } from 'react'
import { emitEndpointsChanged, getAuthHeaders } from '@/lib/authToken'
import type { Endpoint } from '@/components/DashboardClient'

const apiBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001'

type EndpointEditFormProps = {
  endpoint: Endpoint
  onCancel: () => void
  onSaved: () => void
}

function parseStatusCodes(value: string) {
  return value
    .split(',')
    .map((status) => Number(status.trim()))
    .filter((status) => Number.isInteger(status))
}

export function EndpointEditForm({ endpoint, onCancel, onSaved }: EndpointEditFormProps) {
  const [method, setMethod] = useState(endpoint.method)
  const [expectedStatus, setExpectedStatus] = useState(endpoint.expectedStatus.join(', '))
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const statusCodes = parseStatusCodes(expectedStatus)

    if (statusCodes.length === 0) {
      setMessage('Add at least one expected status.')
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

    setMessage('')

    startTransition(async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/endpoints/${endpoint.id}`, {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const body = await response.json()

        if (!response.ok || !body.success) {
          setMessage('Could not save changes.')
          return
        }

        emitEndpointsChanged()
        onSaved()
      } catch {
        setMessage('Could not save changes.')
      }
    })
  }

  return (
    <form className="edit-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          <span>Name</span>
          <input name="name" minLength={3} maxLength={100} defaultValue={endpoint.name} required />
        </label>

        <label className="field-wide">
          <span>URL</span>
          <input name="url" type="url" defaultValue={endpoint.url} required />
        </label>

        <label>
          <span>Method</span>
          <select value={method} onChange={(event) => setMethod(event.target.value)}>
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
            inputMode="numeric"
            onChange={(event) => setExpectedStatus(event.target.value)}
            value={expectedStatus}
            required
          />
        </label>

        <label>
          <span>Interval</span>
          <input name="interval" type="number" min={10} step={5} defaultValue={endpoint.interval} required />
        </label>

        <label>
          <span>Timeout</span>
          <input name="timeout" type="number" min={1000} step={500} defaultValue={endpoint.timeout} required />
        </label>

        <label className="field-wide">
          <span>Body contains</span>
          <input
            name="expectedBodyContains"
            placeholder="Optional response text"
            defaultValue={endpoint.expectedBodyContains || ''}
          />
        </label>
      </div>

      <div className="form-footer">
        <button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save changes'}
        </button>
        <button className="ghost-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        {message ? <p className="form-message error">{message}</p> : null}
      </div>
    </form>
  )
}

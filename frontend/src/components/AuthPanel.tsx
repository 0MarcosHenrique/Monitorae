'use client'

import { FormEvent, useEffect, useState, useTransition } from 'react'
import { clearAuthToken, getAuthHeaders, getAuthToken, setAuthToken } from '@/lib/authToken'

const apiBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001'

type AuthMode = 'login' | 'register'

type AuthUser = {
  id: string
  email: string
  name: string | null
}

type AuthResponse = {
  success: boolean
  data: {
    user: AuthUser
    token: string
  }
  error: unknown
}

type MeResponse = {
  success: boolean
  data: AuthUser
  error: unknown
}

export function AuthPanel() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const token = getAuthToken()

    if (!token) {
      return
    }

    fetch(`${apiBaseUrl}/api/auth/me`, {
      headers: getAuthHeaders(),
    })
      .then((response) => response.json())
      .then((body: MeResponse) => {
        if (body.success) {
          setUser(body.data)
        } else {
          clearAuthToken()
        }
      })
      .catch(() => clearAuthToken())
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    const payload = {
      email: String(formData.get('email')),
      password: String(formData.get('password')),
      name: mode === 'register' ? String(formData.get('name') || '') || undefined : undefined,
    }

    setMessage('')

    startTransition(async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/auth/${mode}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const body = (await response.json()) as AuthResponse

        if (!response.ok || !body.success) {
          setMessage(mode === 'login' ? 'Invalid login.' : 'Could not register.')
          return
        }

        setAuthToken(body.data.token)
        setUser(body.data.user)
        form.reset()
        setMessage('Authenticated.')
      } catch {
        setMessage('Could not connect to auth API.')
      }
    })
  }

  function handleLogout() {
    clearAuthToken()
    setUser(null)
    setMessage('')
  }

  return (
    <div className="auth-panel">
      <div>
        <h2>Account</h2>
        <p>{user ? `Signed in as ${user.email}` : 'Use an account to keep new monitors under your user.'}</p>
      </div>

      {user ? (
        <button className="secondary-button" onClick={handleLogout} type="button">
          Logout
        </button>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-tabs" role="tablist" aria-label="Auth mode">
            <button
              className={mode === 'login' ? 'active' : ''}
              onClick={() => setMode('login')}
              type="button"
            >
              Login
            </button>
            <button
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
              type="button"
            >
              Register
            </button>
          </div>

          {mode === 'register' ? (
            <input name="name" placeholder="Name" />
          ) : null}
          <input name="email" placeholder="Email" required type="email" />
          <input name="password" minLength={8} placeholder="Password" required type="password" />
          <button disabled={isPending} type="submit">
            {isPending ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>
      )}

      {message ? <p className="auth-message">{message}</p> : null}
    </div>
  )
}

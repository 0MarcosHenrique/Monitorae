export const authTokenKey = 'monitorae.authToken'
export const authChangedEvent = 'monitorae:auth-changed'
export const endpointsChangedEvent = 'monitorae:endpoints-changed'

export const emitEndpointsChanged = () => {
  window.dispatchEvent(new Event(endpointsChangedEvent))
}

export const getAuthToken = () => {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(authTokenKey)
}

export const setAuthToken = (token: string) => {
  window.localStorage.setItem(authTokenKey, token)
  window.dispatchEvent(new Event(authChangedEvent))
}

export const clearAuthToken = () => {
  window.localStorage.removeItem(authTokenKey)
  window.dispatchEvent(new Event(authChangedEvent))
}

export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken()

  if (!token) {
    return {}
  }

  return { Authorization: `Bearer ${token}` }
}

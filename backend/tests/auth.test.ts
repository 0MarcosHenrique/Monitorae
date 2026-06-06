import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createAuthToken, hashPassword, verifyAuthToken, verifyPassword } from '../src/services/auth'

describe('auth service', () => {
  it('hashes and verifies passwords', () => {
    const hash = hashPassword('super-secret')

    assert.equal(verifyPassword('super-secret', hash), true)
    assert.equal(verifyPassword('wrong-secret', hash), false)
  })

  it('creates and verifies auth tokens', () => {
    const token = createAuthToken('user-123')
    const payload = verifyAuthToken(token)

    assert.equal(payload?.userId, 'user-123')
  })
})

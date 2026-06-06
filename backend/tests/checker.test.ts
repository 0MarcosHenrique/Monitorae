import { createServer, Server } from 'http'
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { runHealthCheck } from '../src/services/checker'

let server: Server
let baseUrl: string

before(async () => {
  server = createServer((request, response) => {
    if (request.url === '/ok') {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ status: 'ready' }))
      return
    }

    response.writeHead(500, { 'Content-Type': 'text/plain' })
    response.end('failed')
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()

  if (!address || typeof address === 'string') {
    throw new Error('Could not start test server')
  }

  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
})

describe('runHealthCheck', () => {
  it('marks an endpoint as up when status and body match', async () => {
    const result = await runHealthCheck({
      url: `${baseUrl}/ok`,
      method: 'GET',
      timeout: 1000,
      expectedStatus: [200],
      expectedBodyContains: 'ready',
    })

    assert.equal(result.isUp, true)
    assert.equal(result.statusCode, 200)
    assert.equal(result.errorMessage, null)
  })

  it('marks an endpoint as down when body validation fails', async () => {
    const result = await runHealthCheck({
      url: `${baseUrl}/ok`,
      method: 'GET',
      timeout: 1000,
      expectedStatus: [200],
      expectedBodyContains: 'missing-text',
    })

    assert.equal(result.isUp, false)
    assert.equal(result.statusCode, 200)
    assert.match(result.errorMessage || '', /missing-text/)
  })
})

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const tokenSecret = process.env.AUTH_TOKEN_SECRET || 'monitorae-dev-secret'
const tokenTtlSeconds = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7)

type TokenPayload = {
  userId: string
  exp: number
}

const toBase64Url = (input: string | Buffer) => {
  return Buffer.from(input)
    .toString('base64url')
}

const sign = (value: string) => {
  return createHmac('sha256', tokenSecret).update(value).digest('base64url')
}

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')

  return `${salt}:${hash}`
}

export const verifyPassword = (password: string, storedHash: string) => {
  const [salt, hash] = storedHash.split(':')

  if (!salt || !hash) {
    return false
  }

  const derived = scryptSync(password, salt, 64)
  const stored = Buffer.from(hash, 'hex')

  if (derived.length !== stored.length) {
    return false
  }

  return timingSafeEqual(derived, stored)
}

export const createAuthToken = (userId: string) => {
  const payload: TokenPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds,
  }
  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const signature = sign(encodedPayload)

  return `${encodedPayload}.${signature}`
}

export const verifyAuthToken = (token: string): TokenPayload | null => {
  const [encodedPayload, signature] = token.split('.')

  if (!encodedPayload || !signature) {
    return null
  }

  if (sign(encodedPayload) !== signature) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as TokenPayload

    if (!payload.userId || payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let redis: Redis | null | undefined

function getRedis(): Redis | null {
  if (redis !== undefined) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  redis = url && token ? new Redis({ url, token }) : null
  return redis
}

export interface RateLimitResult {
  allowed: boolean
  scope?: 'company' | 'visitor'
  retryAfterSec?: number
}

// Limits are read from the DB per-request (admin-adjustable), so the Ratelimit
// instance is constructed fresh each call rather than module-level — cheap, since
// it's just config until .limit() actually hits Redis.
export async function checkRateLimit(
  companySlug: string,
  clientIp: string,
  companyLimitPerMinute: number | null,
  visitorLimitPerMinute: number | null
): Promise<RateLimitResult> {
  const client = getRedis()
  if (!client) return { allowed: true }

  if (companyLimitPerMinute && companyLimitPerMinute > 0) {
    const limiter = new Ratelimit({ redis: client, limiter: Ratelimit.slidingWindow(companyLimitPerMinute, '60 s'), prefix: 'rl:company' })
    const { success, reset } = await limiter.limit(companySlug)
    if (!success) return { allowed: false, scope: 'company', retryAfterSec: Math.max(0, Math.ceil((reset - Date.now()) / 1000)) }
  }

  if (visitorLimitPerMinute && visitorLimitPerMinute > 0) {
    const limiter = new Ratelimit({ redis: client, limiter: Ratelimit.slidingWindow(visitorLimitPerMinute, '60 s'), prefix: 'rl:visitor' })
    const { success, reset } = await limiter.limit(`${companySlug}:${clientIp}`)
    if (!success) return { allowed: false, scope: 'visitor', retryAfterSec: Math.max(0, Math.ceil((reset - Date.now()) / 1000)) }
  }

  return { allowed: true }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}

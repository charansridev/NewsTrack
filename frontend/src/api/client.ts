/**
 * Axios instance for the NewsTrack API.
 *
 * - Injects the correct bearer token per request. Default audience is the
 *   platform user; driver-app calls pass `{ audience: 'driver' }` in config.
 * - Normalizes the API error envelope `{ error: { code, message, details } }`
 *   into a thrown `ApiClientError`.
 * - On a 401 for a user request, tries a one-shot refresh via /auth/refresh,
 *   then retries; on failure it clears the session and redirects to /login.
 */
import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { env } from '@/lib/env'
import { tokenStore, type Audience } from '@/auth/tokenStore'
import type { ApiError } from '@/types/models'

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Which JWT system to authenticate with. Defaults to 'user'. */
    audience?: Audience
    /** Internal: marks a request already retried after refresh. */
    _retried?: boolean
  }
}

export class ApiClientError extends Error {
  code: string
  status?: number
  details?: ApiError['error']['details']

  constructor(message: string, code: string, status?: number, details?: ApiError['error']['details']) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export const api = axios.create({
  baseURL: env.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const audience: Audience = config.audience ?? 'user'
  const token =
    audience === 'driver' ? tokenStore.getDriverAccess() : tokenStore.getUserAccess()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing: Promise<string | null> | null = null

async function refreshUserToken(): Promise<string | null> {
  const refresh = tokenStore.getUserRefresh()
  if (!refresh) return null
  try {
    const res = await axios.post(`${env.apiBaseUrl}/auth/refresh`, {
      refresh_token: refresh,
    })
    const access = res.data?.access_token as string | undefined
    if (access) {
      tokenStore.setUserAccess(access)
      return access
    }
  } catch {
    /* fall through to logout */
  }
  return null
}

function redirectToLogin(audience: Audience) {
  tokenStore.clearUser()
  if (audience === 'driver') tokenStore.clearDriver()
  const path = audience === 'driver' ? '/driver/login' : '/login'
  if (!window.location.pathname.startsWith(path)) {
    window.location.assign(path)
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiError>) => {
    const config = error.config as (InternalAxiosRequestConfig & AxiosRequestConfig) | undefined
    const audience: Audience = config?.audience ?? 'user'
    const status = error.response?.status

    // One-shot refresh for expired user access tokens.
    if (status === 401 && audience === 'user' && config && !config._retried) {
      config._retried = true
      refreshing ??= refreshUserToken().finally(() => {
        refreshing = null
      })
      const access = await refreshing
      if (access) {
        config.headers.Authorization = `Bearer ${access}`
        return api.request(config)
      }
      redirectToLogin('user')
    } else if (status === 401) {
      redirectToLogin(audience)
    }

    const envelope = error.response?.data?.error
    throw new ApiClientError(
      envelope?.message ?? error.message ?? 'Request failed',
      envelope?.code ?? 'NETWORK_ERROR',
      status,
      envelope?.details,
    )
  },
)

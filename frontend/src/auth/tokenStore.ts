/**
 * Token storage for the TWO independent JWT systems.
 *
 * User tokens and driver tokens are NOT interchangeable, so they live in
 * separate slots. Access tokens are kept in memory + mirrored to localStorage
 * for reloads; the user refresh token persists so we can mint new access tokens.
 */

const USER_ACCESS = 'nt.user.access'
const USER_REFRESH = 'nt.user.refresh'
const DRIVER_ACCESS = 'nt.driver.access'

export type Audience = 'user' | 'driver'

export const tokenStore = {
  getUserAccess: () => localStorage.getItem(USER_ACCESS),
  getUserRefresh: () => localStorage.getItem(USER_REFRESH),
  getDriverAccess: () => localStorage.getItem(DRIVER_ACCESS),

  setUser(access: string, refresh?: string) {
    localStorage.setItem(USER_ACCESS, access)
    if (refresh) localStorage.setItem(USER_REFRESH, refresh)
  },
  setUserAccess(access: string) {
    localStorage.setItem(USER_ACCESS, access)
  },
  setDriver(access: string) {
    localStorage.setItem(DRIVER_ACCESS, access)
  },

  clearUser() {
    localStorage.removeItem(USER_ACCESS)
    localStorage.removeItem(USER_REFRESH)
  },
  clearDriver() {
    localStorage.removeItem(DRIVER_ACCESS)
  },
}

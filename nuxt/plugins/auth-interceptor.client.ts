/**
 * Authentication interceptor plugin for handling 401 responses globally (EN)
 * Plugin interceptor xác thực để xử lý phản hồi 401 toàn cục (VI)
 */
import { logger } from '~/utils/logger'
const bearerTokenPattern = /^Bearer\s+(.+)$/i
export default defineNuxtPlugin(() => {
  // Handle global unhandled promise rejections for API errors
  if (process.client) {
    const originalFetch = window.fetch
    const authStore = useAuthStore()
    
    window.fetch = async (...args) => {
      // Reading the bearer must never fail the caller's fetch: an unparsable header only disables the 401 match.
      let requestToken: string | undefined
      try {
        const requestHeaders = args[1]?.headers ?? (args[0] instanceof Request ? args[0].headers : undefined)
        const authorization = requestHeaders instanceof Headers
          ? requestHeaders.get('Authorization')
          : requestHeaders ? new Headers(requestHeaders).get('Authorization') : null
        requestToken = authorization?.match(bearerTokenPattern)?.[1]
      } catch {
        requestToken = undefined
      }
      try {
        const response = await originalFetch(...args)
        
        // Check for 401 Unauthorized on any fetch request
        if (response.status === 401 && requestToken && authStore.token === requestToken) {
          logger.dev('🔐 Global 401 interceptor - clearing auth and redirecting to login')
          
          await authStore.clearAuthState()
          
          // Use navigateTo to redirect to login
          await navigateTo('/auth/login')
        }
        
        return response
      } catch (error) {
        throw error
      }
    }
  }
})
/**
 * Authentication interceptor plugin for handling 401 responses globally (EN)
 * Plugin interceptor xác thực để xử lý phản hồi 401 toàn cục (VI)
 */
import { logger } from '~/utils/logger'
export default defineNuxtPlugin(() => {
  // Handle global unhandled promise rejections for API errors
  if (process.client) {
    const originalFetch = window.fetch
    
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args)
        
        // Check for 401 Unauthorized on any fetch request
        if (response.status === 401) {
          logger.dev('🔐 Global 401 interceptor - clearing auth and redirecting to login')
          
          const authStore = useAuthStore()
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
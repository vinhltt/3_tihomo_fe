/**
 * Debug utilities for authentication state
 * Tiện ích debug cho trạng thái xác thực
 */

import { logger } from '~/utils/logger'
export function debugAuthState(context: string) {
  const tokenCookie = useCookie('auth-token', { default: () => null })
  const refreshCookie = useCookie('refresh-token', { default: () => null })
  
  console.group(`🔍 Auth Debug - ${context}`)
  logger.dev('Process:', process.server ? 'SERVER' : 'CLIENT')
  logger.dev('Token Cookie:', tokenCookie.value ? '✅ Present' : '❌ Missing')
  logger.dev('Refresh Cookie:', refreshCookie.value ? '✅ Present' : '❌ Missing')
  
  if (process.client) {
    const authStore = useAuthStore()
    logger.dev('Store Authenticated:', authStore.isAuthenticated)
    logger.dev('Store Loading:', authStore.isLoading)
    logger.dev('Store Error:', authStore.error)
  }
  
  console.groupEnd()
}

export function logAuthFlow(step: string, details?: any) {
  logger.dev(`🔐 Auth Flow: ${step}`, details || '')
}

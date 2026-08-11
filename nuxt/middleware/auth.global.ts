/**
 * Global authentication middleware (EN)
 * Middleware xác thực toàn cục (VI)
 * 
 * This middleware runs on every route change and automatically:
 * - Initializes authentication state
 * - Checks if user is authenticated for protected routes
 * - Clears auth state and redirects to login if not authenticated
 * - Allows access to public routes without authentication
 */
import { logger } from '~/utils/logger'
export default defineNuxtRouteMiddleware(async (to) => {
  // Check authentication on both server and client to prevent hydration mismatch
  // Kiểm tra xác thực trên cả server và client để tránh hydration mismatch
  
  const authStore = useAuthStore()
  
  // Debug logging
  if (process.dev) {
    logger.dev(`🔐 [${process.server ? 'SERVER' : 'CLIENT'}] Auth middleware for:`, to.path)
  }
  
  // On server-side, check for auth token in cookies directly
  // Trên server-side, kiểm tra auth token trong cookies trực tiếp
  let isAuthenticated = false
  
  if (process.server) {
    // Server-side: Check cookies directly
    const tokenCookie = useCookie('auth-token', { default: () => null })
    isAuthenticated = !!tokenCookie.value
    if (process.dev) {
      logger.dev(`🔍 [SERVER] Token check:`, isAuthenticated ? '✅ Has token' : '❌ No token')
    }
  } else {
    // Client-side: Use store state or initialize if needed
    if (!authStore.isAuthenticated && !authStore.isLoading) {
      try {
        await authStore.initAuth()
      } catch (error) {
        logger.warn('Failed to initialize auth:', error)
      }
    }
    isAuthenticated = authStore.isAuthenticated
    if (process.dev) {
      logger.dev(`🔍 [CLIENT] Auth state:`, isAuthenticated ? '✅ Authenticated' : '❌ Not authenticated')
    }
  }
  
    // Check if route has auth disabled in page meta
  if (to.meta.auth === false) {
    // If user is already authenticated and trying to access login pages, redirect to home
    if (isAuthenticated && (to.path.startsWith('/auth/login') || to.path.startsWith('/auth/cover-login'))) {
      logger.dev('🏠 User already authenticated, redirecting to home')
      return navigateTo('/')
    }
    return
  }

  // List of public routes that don't require authentication (fallback)
  const publicRoutes = [
    '/auth/login',
    '/auth/cover-login', 
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify-email'
  ]
  
  // Check if current route is public
  const isPublicRoute = publicRoutes.some(route => to.path.startsWith(route))
    // If it's a public route, allow access
  if (isPublicRoute) {
    // If user is already authenticated and trying to access login pages, redirect to home
    if (isAuthenticated && (to.path.startsWith('/auth/login') || to.path.startsWith('/auth/cover-login'))) {
      logger.dev('🏠 User already authenticated, redirecting to home')
      return navigateTo('/')
    }
    return
  }
  
  // For protected routes, check authentication
  if (!isAuthenticated) {
    logger.dev('🔒 User not authenticated for protected route:', to.path)
    logger.dev('🧹 Clearing auth state and redirecting to login')
    
    // Clear authentication state and cookies (only on client-side)
    if (process.client) {
      authStore.clearAuthState()
    }
      // Redirect to cover-login page with return URL
    const returnUrl = to.fullPath !== '/' ? `?returnUrl=${encodeURIComponent(to.fullPath)}` : ''
    return navigateTo(`/auth/cover-login${returnUrl}`)
  }
  
  // User is authenticated, allow access
  logger.dev('✅ User authenticated, allowing access to:', to.path)
})

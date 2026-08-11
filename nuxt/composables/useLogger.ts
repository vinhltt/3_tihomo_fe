/**
 * Logger Composable for Nuxt 3 (EN)
 * Composable Logger cho Nuxt 3 (VI)
 * 
 * @module composables/useLogger
 * @description Vue 3 composable for secure logging in Nuxt applications
 * 
 * @example
 * ```vue
 * <script setup>
 * const logger = useLogger('[MyComponent]')
 * 
 * onMounted(() => {
 *   logger.dev('Component mounted')
 * })
 * 
 * async function handleSubmit() {
 *   try {
 *     await submitForm(data)
 *     logger.info('Form submitted', { userId: user.id })
 *   } catch (error) {
 *     logger.error('Form submission failed', error)
 *   }
 * }
 * </script>
 * ```
 */

import { Logger, createLogger } from '~/utils/logger'
import type { LoggerOptions, ILogger } from '~/types/logger'
import { getCurrentInstance } from 'vue'

/**
 * Use Logger Composable (EN)
 * Composable sử dụng Logger (VI)
 * 
 * Returns a logger instance for use in Vue components.
 * Can create component-specific loggers with prefixes.
 * 
 * @param prefixOrOptions - Component prefix string or full options
 * @returns Logger instance
 * 
 * @example
 * ```ts
 * // Simple prefix
 * const logger = useLogger('[Auth]')
 * 
 * // Full options
 * const logger = useLogger({
 *   prefix: '[API]',
 *   minLevel: 'warn',
 *   enableSSRLabels: true
 * })
 * ```
 */
export function useLogger(prefixOrOptions?: string | LoggerOptions): ILogger {
  // If string provided, treat as prefix
  if (typeof prefixOrOptions === 'string') {
    return createLogger({ prefix: prefixOrOptions })
  }
  
  // If options provided, create with options
  if (prefixOrOptions) {
    return createLogger(prefixOrOptions)
  }
  
  // Default: return singleton instance
  return Logger.getInstance()
}

/**
 * Use Component Logger (EN)
 * Composable Logger cho Component (VI)
 * 
 * Automatically creates logger with component name as prefix.
 * Detects component name from Vue's getCurrentInstance.
 * 
 * @param options - Optional logger configuration
 * @returns Logger instance with component name prefix
 * 
 * @example
 * ```vue
 * <script setup>
 * const logger = useComponentLogger()
 * // Logs will be prefixed with component name: [LoginPage]
 * 
 * logger.dev('Component lifecycle event')
 * </script>
 * ```
 */
export function useComponentLogger(options?: Omit<LoggerOptions, 'prefix'>): ILogger {
  // Try to get component name from Vue instance
  let componentName = 'Component'
  
  try {
    const instance = getCurrentInstance()
    
    if (instance?.type?.name) {
      componentName = instance.type.name
    } else if (instance?.type?.__name) {
      componentName = instance.type.__name
    }
  } catch {
    // Fallback if getCurrentInstance not available
  }
  
  return createLogger({
    ...options,
    prefix: `[${componentName}]`
  })
}

/**
 * Use API Logger (EN)
 * Composable Logger cho API calls (VI)
 * 
 * Pre-configured logger for API requests with [API] prefix.
 * 
 * @returns Logger instance for API calls
 * 
 * @example
 * ```ts
 * const apiLogger = useApiLogger()
 * 
 * async function fetchUsers() {
 *   apiLogger.dev('Fetching users...')
 *   const response = await $fetch('/api/users')
 *   apiLogger.info('Users fetched', { count: response.length })
 * }
 * ```
 */
export function useApiLogger(): ILogger {
  return createLogger({
    prefix: '[API]',
    enableSSRLabels: true
  })
}

/**
 * Use Auth Logger (EN)
 * Composable Logger cho Authentication (VI)
 * 
 * Pre-configured logger for authentication flows.
 * Higher minLevel to reduce noise in production.
 * 
 * @returns Logger instance for auth operations
 * 
 * @example
 * ```ts
 * const authLogger = useAuthLogger()
 * 
 * async function login(credentials) {
 *   authLogger.info('Login attempt', { username: credentials.username })
 *   // Note: password is automatically sanitized
 *   try {
 *     const result = await authenticate(credentials)
 *     authLogger.info('Login success', { userId: result.userId })
 *   } catch (error) {
 *     authLogger.error('Login failed', error)
 *   }
 * }
 * ```
 */
export function useAuthLogger(): ILogger {
  return createLogger({
    prefix: '[AUTH]',
    minLevel: 'info',
    enableSSRLabels: true
  })
}

/**
 * Export createLogger for direct usage (EN)
 * Export createLogger để dùng trực tiếp (VI)
 * 
 * Re-export from utils/logger for convenience.
 * Allows direct logger creation without going through composables.
 */
export { createLogger }

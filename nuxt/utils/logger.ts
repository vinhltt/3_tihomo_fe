/**
 * Secure Logger Utility for TiHoMo (EN)
 * Tiện ích Logger Bảo mật cho TiHoMo (VI)
 * 
 * @module utils/logger
 * @description Centralized logging with automatic sanitization and environment-aware behavior
 * 
 * Features:
 * - Automatic sensitive data sanitization (password, token, cardNumber, etc.)
 * - Environment-aware logging (dev/production)
 * - SSR/CSR context detection
 * - Structured logging with context
 * - Tree-shakeable exports for zero production overhead
 * - Singleton pattern for global logger
 * 
 * Security:
 * - CWE-532: Prevents sensitive information in logs
 * - PCI-DSS 3.4: Masks payment card data
 * - GDPR Article 32: Protects personal data
 * 
 * @example
 * ```ts
 * import { logger } from '~/utils/logger'
 * 
 * // Development-only logs (stripped in production)
 * logger.dev('Debug info', { data: 'test' })
 * 
 * // Structured logging with context
 * logger.info('User login', {
 *   userId: 'user-123',
 *   component: 'AuthPage'
 * })
 * 
 * // Automatic sanitization
 * logger.info('Auth', { password: 'secret' }) // password: '[REDACTED]'
 * ```
 */

import type { ILogger, LogLevel, LogContext, LoggerOptions, SanitizerConfig } from '~/types/logger'
import { DEFAULT_SANITIZER_CONFIG } from '~/types/logger'
import { sanitizeData } from './sanitizer'
import { isDevelopment, isProduction, shouldLog, getEnvironmentLabel } from './env'

/**
 * Logger Class Implementation (EN)
 * Triển khai Logger Class (VI)
 * 
 * Singleton pattern for global instance.
 * Can also create independent instances with custom config.
 */
export class Logger implements ILogger {
  private static instance: Logger | null = null
  
  private config: Required<LoggerOptions>
  
  /**
   * Constructor (EN)
   * Hàm khởi tạo (VI)
   * 
   * @param options - Logger configuration options
   */
  constructor(options: LoggerOptions = {}) {
    this.config = {
      sanitizerConfig: {
        ...DEFAULT_SANITIZER_CONFIG,
        ...options.sanitizerConfig
      },
      enabled: options.enabled ?? true,
      minLevel: options.minLevel ?? 'dev',
      prefix: options.prefix ?? '',
      enableSSRLabels: options.enableSSRLabels ?? false
    }
  }
  
  /**
   * Get singleton instance (EN)
   * Lấy singleton instance (VI)
   * 
   * @param options - Configuration (only used on first call)
   * @returns Shared logger instance
   */
  static getInstance(options?: LoggerOptions): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(options)
    }
    return Logger.instance
  }
  
  /**
   * Format log message with prefix and labels (EN)
   * Định dạng log message với prefix và labels (VI)
   */
  private formatMessage(...args: any[]): any[] {
    const parts: string[] = []
    
    // Add prefix if configured
    if (this.config.prefix) {
      parts.push(this.config.prefix)
    }
    
    // Add SSR/CSR label if enabled
    if (this.config.enableSSRLabels) {
      const envLabel = getEnvironmentLabel()
      if (envLabel) {
        parts.push(envLabel)
      }
    }
    
    // Combine prefix with message
    if (parts.length > 0) {
      return [parts.join(' '), ...args]
    }
    
    return args
  }
  
  /**
   * Check if logging is allowed for this level (EN)
   * Kiểm tra logging có được phép cho level này (VI)
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false
    return shouldLog(level, this.config.minLevel)
  }
  
  /**
   * Development-only logging (EN)
   * Logging chỉ dành cho development (VI)
   * 
   * Stripped completely in production builds via tree-shaking.
   * Use for verbose debugging information.
   * 
   * @param args - Data to log (automatically sanitized)
   * 
   * @example
   * ```ts
   * logger.dev('Component mounted', { props })
   * logger.dev('API response:', response)
   * ```
   */
  dev(...args: any[]): void {
    // Early return for production (dead code elimination)
    if (!isDevelopment()) return
    if (!this.shouldLog('dev')) return
    
    // Sanitize all arguments
    const sanitized = args.map(arg => this.sanitize(arg))
    const formatted = this.formatMessage(...sanitized)
    
    console.log(...formatted)
  }
  
  /**
   * Debug logging (EN)
   * Debug logging (VI)
   * 
   * Similar to dev() but semantic difference.
   * Stripped in production.
   * 
   * @param args - Data to log (automatically sanitized)
   */
  debug(...args: any[]): void {
    if (!isDevelopment()) return
    if (!this.shouldLog('debug')) return
    
    const sanitized = args.map(arg => this.sanitize(arg))
    const formatted = this.formatMessage(...sanitized)
    
    console.debug(...formatted)
  }
  
  /**
   * Informational logging (EN)
   * Logging thông tin (VI)
   * 
   * Use for important application events.
   * May be logged in production depending on minLevel.
   * 
   * @param message - Log message
   * @param context - Optional structured context
   * 
   * @example
   * ```ts
   * logger.info('User logged in', {
   *   userId: 'user-123',
   *   correlationId: 'abc-def'
   * })
   * ```
   */
  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return
    
    const sanitizedContext = context ? this.sanitize(context) : undefined
    const formatted = this.formatMessage(message, sanitizedContext)
    
    console.info(...formatted)
  }
  
  /**
   * Warning logging (EN)
   * Logging cảnh báo (VI)
   * 
   * Use for recoverable errors or unusual conditions.
   * Always logged in all environments.
   * 
   * @param message - Warning message
   * @param context - Optional structured context
   * 
   * @example
   * ```ts
   * logger.warn('API rate limit approaching', {
   *   remaining: 10,
   *   resetAt: timestamp
   * })
   * ```
   */
  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return
    
    const sanitizedContext = context ? this.sanitize(context) : undefined
    const formatted = this.formatMessage(message, sanitizedContext)
    
    console.warn(...formatted)
  }
  
  /**
   * Error logging (EN)
   * Logging lỗi (VI)
   * 
   * Use for errors and exceptions.
   * Always logged in all environments.
   * 
   * @param message - Error message
   * @param error - Error object or additional data
   * @param context - Optional structured context
   * 
   * @example
   * ```ts
   * try {
   *   await fetchData()
   * } catch (error) {
   *   logger.error('Failed to fetch data', error, {
   *     correlationId: 'xyz',
   *     userId: 'user-123'
   *   })
   * }
   * ```
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog('error')) return
    
    // Build error info
    const errorInfo: any = {}
    
    if (error instanceof Error) {
      errorInfo.name = error.name
      errorInfo.message = error.message
      errorInfo.stack = error.stack
    } else if (error) {
      errorInfo.data = error
    }
    
    const sanitizedError = this.sanitize(errorInfo)
    const sanitizedContext = context ? this.sanitize(context) : undefined
    
    const formatted = this.formatMessage(
      message,
      sanitizedError,
      sanitizedContext
    )
    
    console.error(...formatted)
  }
  
  /**
   * Manual data sanitization (EN)
   * Sanitize dữ liệu thủ công (VI)
   * 
   * Use when you need to sanitize data before logging manually.
   * 
   * @param data - Data to sanitize
   * @returns Sanitized copy of data
   * 
   * @example
   * ```ts
   * const userData = { password: 'secret', email: 'user@example.com' }
   * const safe = logger.sanitize(userData)
   * console.log(safe) // { password: '[REDACTED]', email: 'user@example.com' }
   * ```
   */
  sanitize<T = any>(data: T): T {
    // Don't sanitize primitives
    if (typeof data !== 'object' || data === null) {
      return data
    }
    
    return sanitizeData(data, this.config.sanitizerConfig)
  }
}

/**
 * Default logger instance (EN)
 * Logger instance mặc định (VI)
 * 
 * Pre-configured singleton for general use.
 * Import and use directly in your components.
 * 
 * @example
 * ```ts
 * import { logger } from '~/utils/logger'
 * 
 * logger.dev('Debug message')
 * logger.info('User action')
 * logger.error('Error occurred', error)
 * ```
 */
export const logger = Logger.getInstance()

/**
 * Create a logger with custom configuration (EN)
 * Tạo logger với cấu hình tùy chỉnh (VI)
 * 
 * Use for component-specific loggers with prefixes.
 * 
 * @param options - Logger configuration
 * @returns New logger instance
 * 
 * @example
 * ```ts
 * const authLogger = createLogger({ prefix: '[AUTH]' })
 * const apiLogger = createLogger({ prefix: '[API]', minLevel: 'warn' })
 * ```
 */
export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options)
}

/**
 * Tree-shakeable log functions (EN)
 * Hàm log có thể tree-shake (VI)
 * 
 * Individual exports for maximum tree-shaking.
 * Unused functions will be eliminated in production builds.
 */
export const dev = (...args: any[]) => logger.dev(...args)
export const debug = (...args: any[]) => logger.debug(...args)
export const info = (message: string, context?: LogContext) => logger.info(message, context)
export const warn = (message: string, context?: LogContext) => logger.warn(message, context)
export const error = (message: string, err?: Error | unknown, context?: LogContext) => logger.error(message, err, context)
export const sanitize = <T = any>(data: T): T => logger.sanitize(data)

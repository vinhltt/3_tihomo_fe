/**
 * Utils Barrel Export (EN)
 * Barrel Export cho Utils (VI)
 * 
 * @module utils/index
 * @description Central export point for all utilities
 */

// Logger exports
export { logger, Logger, createLogger, dev, debug, info, warn, error, sanitize } from './logger'
export type { ILogger, LogLevel, LogContext, LoggerOptions } from '~/types/logger'

// Sanitizer exports
export { sanitizeData, isSensitiveKey, markAsSanitized, isSanitized } from './sanitizer'
export type { SanitizerConfig, Sanitized } from '~/types/logger'

// Environment exports
export { isDevelopment, isProduction, isSSR, getCurrentEnvironment, shouldLog, getEnvironmentLabel } from './env'

// Default export: logger instance
export { logger as default } from './logger'

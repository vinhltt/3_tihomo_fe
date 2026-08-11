/**
 * Environment Detection Utility for TiHoMo (EN)
 * Tiện ích Phát hiện Môi trường cho TiHoMo (VI)
 * 
 * @module utils/env
 * @description Environment detection using import.meta.env as single source of truth
 * 
 * Design Decision:
 * - Uses import.meta.env.DEV/PROD/SSR for build-time optimization
 * - Dead code elimination via Vite/esbuild tree-shaking
 * - Zero runtime overhead in production builds
 */

import type { LogLevel } from '~/types/logger'
import { LOG_LEVEL_PRIORITY } from '~/types/logger'

/**
 * Check if running in development environment (EN)
 * Kiểm tra có đang chạy trong môi trường development (VI)
 * 
 * @returns true if in development mode
 * 
 * Build-time constant: This will be replaced with literal true/false
 * during build, enabling dead code elimination.
 */
export function isDevelopment(): boolean {
  // Check global mock first (for testing)
  if (typeof globalThis !== 'undefined' && 'import' in globalThis) {
    // @ts-ignore
    const mockEnv = globalThis['import']?.meta?.env
    if (mockEnv && typeof mockEnv.DEV !== 'undefined') {
      return mockEnv.DEV === true
    }
  }
  
  // @ts-ignore - import.meta.env is defined by Vite
  return import.meta.env?.DEV === true
}

/**
 * Check if running in production environment (EN)
 * Kiểm tra có đang chạy trong môi trường production (VI)
 * 
 * @returns true if in production mode
 * 
 * Build-time constant: Enables tree-shaking of dev-only code.
 */
export function isProduction(): boolean {
  // Check global mock first (for testing)
  if (typeof globalThis !== 'undefined' && 'import' in globalThis) {
    // @ts-ignore
    const mockEnv = globalThis['import']?.meta?.env
    if (mockEnv) {
      if (typeof mockEnv.PROD !== 'undefined') return mockEnv.PROD === true
      if (typeof mockEnv.DEV !== 'undefined') return mockEnv.DEV !== true
    }
  }
  
  // @ts-ignore - import.meta.env is defined by Vite
  return import.meta.env?.PROD === true || import.meta.env?.DEV !== true
}

/**
 * Check if running in SSR context (EN)
 * Kiểm tra có đang chạy trong SSR context (VI)
 * 
 * @returns true if in server-side rendering context
 * 
 * Used for labeling logs with [SSR] or [CSR] prefix.
 */
export function isSSR(): boolean {
  // Check global mock first (for testing)
  if (typeof globalThis !== 'undefined' && 'import' in globalThis) {
    // @ts-ignore
    const mockEnv = globalThis['import']?.meta?.env
    if (mockEnv && typeof mockEnv.SSR !== 'undefined') {
      return mockEnv.SSR === true
    }
  }
  
  // @ts-ignore - import.meta.env.SSR is defined by Nuxt
  return import.meta.env?.SSR === true
}

/**
 * Get current environment name (EN)
 * Lấy tên môi trường hiện tại (VI)
 * 
 * @returns Environment name: 'development', 'production', or 'ssr'
 */
export function getCurrentEnvironment(): 'development' | 'production' | 'ssr' {
  if (isSSR()) return 'ssr'
  if (isDevelopment()) return 'development'
  return 'production'
}

/**
 * Check if a specific log level should be logged (EN)
 * Kiểm tra log level cụ thể có nên được log không (VI)
 * 
 * @param level - Log level to check
 * @param minLevel - Minimum level required (optional)
 * @returns true if level should be logged
 * 
 * Rules:
 * - Development: All levels allowed by minLevel
 * - Production: Only warn and error
 * - SSR: Same as development
 * 
 * @example
 * ```ts
 * shouldLog('dev')              // true in dev, false in prod
 * shouldLog('error')            // always true
 * shouldLog('info', 'warn')     // false (info < warn)
 * ```
 */
export function shouldLog(
  level: LogLevel,
  minLevel: LogLevel = 'dev'
): boolean {
  // In production, only allow warn and error
  if (isProduction()) {
    return level === 'warn' || level === 'error'
  }
  
  // In development/SSR, check minLevel
  const levelPriority = LOG_LEVEL_PRIORITY[level]
  const minPriority = LOG_LEVEL_PRIORITY[minLevel]
  
  return levelPriority >= minPriority
}

/**
 * Get environment label for logs (EN)
 * Lấy nhãn môi trường cho logs (VI)
 * 
 * @returns '[SSR]' or '[CSR]' or empty string
 */
export function getEnvironmentLabel(): string {
  if (!isDevelopment()) return ''
  return isSSR() ? '[SSR]' : '[CSR]'
}

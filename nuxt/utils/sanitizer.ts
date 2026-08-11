/**
 * Data Sanitizer Utility for TiHoMo Secure Logging (EN)
 * Tiện ích Sanitize Dữ liệu cho Logging Bảo mật TiHoMo (VI)
 * 
 * @module utils/sanitizer
 * @description Detects and redacts sensitive data before logging
 * 
 * Security Compliance:
 * - CWE-532: Sensitive Information in Log Files
 * - PCI-DSS Requirement 3.4: Mask PAN when displayed
 * - GDPR Article 32: Security of processing
 */

import { DEFAULT_SANITIZER_CONFIG } from '~/types/logger'
import type { SanitizerConfig, Sanitized } from '~/types/logger'

/**
 * Check if a key name matches sensitive patterns (EN)
 * Kiểm tra tên key có khớp với patterns nhạy cảm (VI)
 * 
 * @param key - Object key name to check
 * @param config - Sanitizer configuration
 * @returns true if key is sensitive
 * 
 * @example
 * ```ts
 * isSensitiveKey('password') // true
 * isSensitiveKey('userId')   // false
 * ```
 */
export function isSensitiveKey(
  key: string,
  config: SanitizerConfig = DEFAULT_SANITIZER_CONFIG
): boolean {
  const lowerKey = config.caseSensitive ? key : key.toLowerCase()
  
  // Check critical patterns (always redact)
  const hasCritical = config.criticalPatterns.some(pattern => {
    const checkPattern = config.caseSensitive ? pattern : pattern.toLowerCase()
    return lowerKey.includes(checkPattern)
  })
  
  if (hasCritical) return true
  
  // Check PII patterns (always redact)
  const hasPII = config.piiPatterns.some(pattern => {
    const checkPattern = config.caseSensitive ? pattern : pattern.toLowerCase()
    return lowerKey.includes(checkPattern)
  })
  
  if (hasPII) return true
  
  // Check context patterns (redact if enabled)
  if (config.enableContextRedaction) {
    const hasContext = config.contextPatterns.some(pattern => {
      const checkPattern = config.caseSensitive ? pattern : pattern.toLowerCase()
      return lowerKey.includes(checkPattern)
    })
    
    if (hasContext) return true
  }
  
  return false
}

/**
 * Sanitize a single value (EN)
 * Sanitize một giá trị đơn (VI)
 * 
 * @param value - Value to sanitize
 * @param config - Sanitizer configuration
 * @returns Sanitized value
 */
function sanitizeValue(value: any, config: SanitizerConfig): any {
  // Handle null/undefined
  if (value == null) return value
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, config))
  }
  
  // Handle objects (recursive)
  if (typeof value === 'object') {
    const sanitized: any = {}
    
    for (const [key, val] of Object.entries(value)) {
      if (isSensitiveKey(key, config)) {
        sanitized[key] = config.redactionText
      } else {
        sanitized[key] = sanitizeValue(val, config)
      }
    }
    
    return sanitized
  }
  
  // Primitive values (string, number, boolean) - return as is
  return value
}

/**
 * Sanitize data by replacing sensitive fields with redaction text (EN)
 * Sanitize dữ liệu bằng cách thay thế các trường nhạy cảm (VI)
 * 
 * @param data - Data object to sanitize
 * @param config - Optional custom sanitizer configuration
 * @returns Sanitized data with sensitive fields redacted
 * 
 * @example
 * ```ts
 * const data = { password: 'secret', userId: '123' }
 * const sanitized = sanitizeData(data)
 * // { password: '[REDACTED]', userId: '123' }
 * ```
 * 
 * Performance: O(n*d) where n = number of keys, d = depth
 * Expected: <1ms for typical log data
 */
export function sanitizeData<T = any>(
  data: T,
  customConfig?: Partial<SanitizerConfig>
): T {
  // Merge custom config with defaults
  const config: SanitizerConfig = {
    ...DEFAULT_SANITIZER_CONFIG,
    ...customConfig
  }
  
  // Deep clone and sanitize
  return sanitizeValue(data, config) as T
}

/**
 * Mark data as sanitized (type safety helper) (EN)
 * Đánh dấu dữ liệu đã được sanitize (helper an toàn kiểu) (VI)
 * 
 * @param data - Data to mark as sanitized
 * @returns Data with sanitized brand
 */
export function markAsSanitized<T>(data: T): Sanitized<T> {
  return Object.assign(data, { __sanitized: true as const })
}

/**
 * Check if data has been sanitized (EN)
 * Kiểm tra dữ liệu đã được sanitize chưa (VI)
 * 
 * @param data - Data to check
 * @returns true if data has been sanitized
 */
export function isSanitized<T>(data: any): data is Sanitized<T> {
  return data && typeof data === 'object' && '__sanitized' in data
}

/**
 * Sanitize with branding (EN)
 * Sanitize với đánh dấu (VI)
 * 
 * @param data - Data to sanitize
 * @param config - Optional configuration
 * @returns Sanitized and branded data
 */
export function sanitizeAndMark<T = any>(
  data: T,
  config?: Partial<SanitizerConfig>
): Sanitized<T> {
  const sanitized = sanitizeData(data, config)
  return markAsSanitized(sanitized)
}

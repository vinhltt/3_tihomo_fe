/**
 * Type definitions for TiHoMo Secure Logging System
 * Định nghĩa kiểu dữ liệu cho Hệ thống Logging Bảo mật TiHoMo
 *
 * @module types/logger
 */

/**
 * Log severity levels for TiHoMo logging system (EN)
 * Các mức độ nghiêm trọng của log cho hệ thống logging TiHoMo (VI)
 *
 * @typedef {('dev'|'info'|'warn'|'error'|'debug')} LogLevel
 */
export type LogLevel = 'dev' | 'info' | 'warn' | 'error' | 'debug'

/**
 * Log level priorities for filtering (EN)
 * Mức độ ưu tiên của log để lọc (VI)
 */
export type LogLevelPriority = {
  readonly dev: 0
  readonly debug: 1
  readonly info: 2
  readonly warn: 3
  readonly error: 4
}

/**
 * Constant defining log level priorities (EN)
 * Hằng số định nghĩa mức độ ưu tiên của log (VI)
 */
export const LOG_LEVEL_PRIORITY: LogLevelPriority = {
  dev: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4
} as const

/**
 * Configuration for sensitive data sanitization (EN)
 * Cấu hình để sanitize dữ liệu nhạy cảm (VI)
 */
export type SanitizerConfig = {
  /**
   * Critical patterns that MUST always be redacted (EN)
   * Các pattern quan trọng PHẢI luôn được che giấu (VI)
   * @example ['password', 'token', 'secret', 'credential']
   */
  criticalPatterns: readonly string[]

  /**
   * PII/Financial patterns requiring redaction (EN)
   * Các pattern PII/Tài chính cần che giấu (VI)
   * @example ['cardNumber', 'cvv', 'ssn', 'accountNumber']
   */
  piiPatterns: readonly string[]

  /**
   * Context-dependent patterns (optional redaction) (EN)
   * Các pattern phụ thuộc ngữ cảnh (che giấu tùy chọn) (VI)
   * @example ['email', 'phone', 'address']
   */
  contextPatterns: readonly string[]

  /**
   * Enable redaction of context-dependent patterns (EN)
   * Bật che giấu cho các pattern phụ thuộc ngữ cảnh (VI)
   * @default false
   */
  enableContextRedaction: boolean

  /**
   * Custom redaction text (EN)
   * Text thay thế khi che giấu (VI)
   * @default '[REDACTED]'
   */
  redactionText: string

  /**
   * Case-sensitive pattern matching (EN)
   * So khớp pattern phân biệt chữ hoa/thường (VI)
   * @default false
   */
  caseSensitive: boolean
}

/**
 * Default sanitizer configuration (EN)
 * Cấu hình sanitizer mặc định (VI)
 */
export const DEFAULT_SANITIZER_CONFIG: SanitizerConfig = {
  criticalPatterns: [
    'password',
    'passwd',
    'pwd',
    'token',
    'auth',
    'authorization',
    'bearer',
    'credential',
    'secret',
    'api_key',
    'apikey',
    'key',
    'private',
    'jwt',
    'session'
  ],
  piiPatterns: [
    'card',
    'cardnumber',
    'cvv',
    'cvc',
    'ssn',
    'social',
    'taxid',
    'account',
    'routing',
    'iban',
    'swift',
    'pin'
  ],
  contextPatterns: [
    'email',
    'phone',
    'address',
    'name'
  ],
  enableContextRedaction: false,
  redactionText: '[REDACTED]',
  caseSensitive: false
} as const

/**
 * Structured context for log entries (EN)
 * Ngữ cảnh có cấu trúc cho log entries (VI)
 */
export type LogContext = {
  /**
   * Correlation ID for distributed tracing (EN)
   * ID tương quan cho distributed tracing (VI)
   */
  correlationId?: string

  /**
   * User ID (sanitized, non-PII) (EN)
   * ID người dùng (đã sanitize, không phải PII) (VI)
   */
  userId?: string

  /**
   * Request ID for API calls (EN)
   * ID yêu cầu cho API calls (VI)
   */
  requestId?: string

  /**
   * Component/module name (EN)
   * Tên component/module (VI)
   */
  component?: string

  /**
   * Action/operation being performed (EN)
   * Hành động/thao tác đang thực hiện (VI)
   */
  action?: string

  /**
   * Timestamp override (ISO 8601) (EN)
   * Ghi đè timestamp (ISO 8601) (VI)
   */
  timestamp?: string

  /**
   * Additional metadata (automatically sanitized) (EN)
   * Metadata bổ sung (tự động sanitize) (VI)
   */
  metadata?: Record<string, any>
}

/**
 * Public logger interface (EN)
 * Interface logger công khai (VI)
 */
export interface ILogger {
  /**
   * Development-only logging (stripped in production) (EN)
   * Logging chỉ cho development (bị loại bỏ ở production) (VI)
   * @param args - Data to log (automatically sanitized)
   */
  dev(...args: any[]): void

  /**
   * Debug logging (stripped in production) (EN)
   * Debug logging (bị loại bỏ ở production) (VI)
   * @param args - Data to log (automatically sanitized)
   */
  debug(...args: any[]): void

  /**
   * Informational logging (sanitized, minimal in production) (EN)
   * Info logging (đã sanitize, tối thiểu ở production) (VI)
   * @param message - Log message
   * @param context - Optional structured context
   */
  info(message: string, context?: LogContext): void

  /**
   * Warning logging (always enabled, sanitized) (EN)
   * Warning logging (luôn bật, đã sanitize) (VI)
   * @param message - Warning message
   * @param context - Optional structured context
   */
  warn(message: string, context?: LogContext): void

  /**
   * Error logging (always enabled, sanitized) (EN)
   * Error logging (luôn bật, đã sanitize) (VI)
   * @param message - Error message
   * @param error - Optional error object
   * @param context - Optional structured context
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void

  /**
   * Manually sanitize data (EN)
   * Sanitize dữ liệu thủ công (VI)
   * @param data - Data to sanitize
   * @returns Sanitized copy of data
   */
  sanitize<T = any>(data: T): T
}

/**
 * Logger instance configuration options (EN)
 * Tùy chọn cấu hình cho logger instance (VI)
 */
export type LoggerOptions = {
  /**
   * Custom sanitizer configuration (EN)
   * Cấu hình sanitizer tùy chỉnh (VI)
   */
  sanitizerConfig?: Partial<SanitizerConfig>

  /**
   * Enable/disable logging globally (EN)
   * Bật/tắt logging toàn cục (VI)
   * @default true
   */
  enabled?: boolean

  /**
   * Minimum log level to output (EN)
   * Mức log tối thiểu để xuất (VI)
   * @default 'dev' in development, 'error' in production
   */
  minLevel?: LogLevel

  /**
   * Prefix for all log messages (EN)
   * Prefix cho tất cả log messages (VI)
   */
  prefix?: string

  /**
   * Enable SSR detection and labeling (EN)
   * Bật phát hiện và gắn nhãn SSR (VI)
   * @default true
   */
  enableSSRLabels?: boolean
}

/**
 * Brand type for sanitized data (EN)
 * Brand type cho dữ liệu đã sanitize (VI)
 */
export type Sanitized<T> = T & { readonly __sanitized: true }

/**
 * Type guard to check if data is sanitized (EN)
 * Type guard để kiểm tra dữ liệu đã sanitize (VI)
 */
export function isSanitized<T>(data: any): data is Sanitized<T> {
  return data && typeof data === 'object' && '__sanitized' in data
}

/**
 * Mark data as sanitized (internal use) (EN)
 * Đánh dấu dữ liệu đã sanitize (sử dụng nội bộ) (VI)
 */
export function markAsSanitized<T>(data: T): Sanitized<T> {
  return Object.assign(data, { __sanitized: true as const })
}

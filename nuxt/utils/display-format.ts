// Fixed display formats, identical in every locale: yyyy/MM/dd, HH:mm (24h), vi-style numbers.
// Empty or invalid input renders as '-'. Parsing and timezone choice belong to the caller.

/**
 * Options for date and time formatting. (EN)
 *
 * Tùy chọn định dạng ngày và giờ. (VI)
 */
export type DisplayDateOptions = {
  /**
   * IANA timezone to render in; omitted means the browser timezone. (EN)
   *
   * Múi giờ IANA dùng để hiển thị; bỏ trống là múi giờ trình duyệt. (VI)
   */
  timeZone?: string
}

type DateInput = Date | string | null | undefined
type DateParts = { year: string; month: string; day: string; hour: string; minute: string }

const EMPTY = '-'
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2, signDisplay: 'negative' })
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()

const getDateTimeFormatter = (timeZone: string | undefined): Intl.DateTimeFormat => {
  const cacheKey = timeZone ?? ''
  let formatter = dateTimeFormatters.get(cacheKey)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone
    })
    dateTimeFormatters.set(cacheKey, formatter)
  }
  return formatter
}

// A date-only string is a calendar date: its digits are rendered as-is, never shifted through a timezone.
const toCalendarDateParts = ([, year, month, day]: RegExpExecArray): DateParts | null => {
  // setUTCFullYear keeps years 0-99 literal (Date.UTC would map them to 19xx), so 0001-01-01 stays valid.
  const check = new Date(0)
  check.setUTCFullYear(Number(year), Number(month) - 1, Number(day))
  const isRealDate = check.getUTCFullYear() === Number(year) && check.getUTCMonth() === Number(month) - 1 && check.getUTCDate() === Number(day)
  return isRealDate ? { year, month, day, hour: '00', minute: '00' } : null
}

const toDateParts = (value: DateInput, timeZone: string | undefined): DateParts | null => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const calendarMatch = typeof value === 'string' ? DATE_ONLY_PATTERN.exec(value) : null
  if (calendarMatch) {
    return toCalendarDateParts(calendarMatch)
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  const parts: Record<string, string> = {}
  for (const part of getDateTimeFormatter(timeZone).formatToParts(date)) {
    parts[part.type] = part.value
  }
  return { year: parts.year.padStart(4, '0'), month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute }
}

/**
 * Formats a date as yyyy/MM/dd; a date-only string (YYYY-MM-DD) is not shifted by timezone. Empty or invalid → '-'. (EN)
 *
 * Định dạng ngày thành yyyy/MM/dd; chuỗi chỉ có ngày (YYYY-MM-DD) không bị lệch múi giờ. Rỗng hoặc không hợp lệ → '-'. (VI)
 */
export const formatDate = (value: DateInput, options?: DisplayDateOptions): string => {
  const parts = toDateParts(value, options?.timeZone)
  return parts ? `${parts.year}/${parts.month}/${parts.day}` : EMPTY
}

/**
 * Formats a timestamp as yyyy/MM/dd HH:mm (24h). Empty or invalid → '-'. (EN)
 *
 * Định dạng mốc thời gian thành yyyy/MM/dd HH:mm (24 giờ). Rỗng hoặc không hợp lệ → '-'. (VI)
 */
export const formatDateTime = (value: DateInput, options?: DisplayDateOptions): string => {
  const parts = toDateParts(value, options?.timeZone)
  return parts ? `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}` : EMPTY
}

/**
 * Formats a timestamp as HH:mm (24h). Empty or invalid → '-'. (EN)
 *
 * Định dạng giờ thành HH:mm (24 giờ). Rỗng hoặc không hợp lệ → '-'. (VI)
 */
export const formatTime = (value: DateInput, options?: DisplayDateOptions): string => {
  const parts = toDateParts(value, options?.timeZone)
  return parts ? `${parts.hour}:${parts.minute}` : EMPTY
}

/**
 * Formats a number vi-style: '.' groups thousands, ',' marks decimals, at most 2 decimals rounded half away from zero,
 * no decimals for whole numbers. null, undefined, NaN or Infinity → '-'. (EN)
 *
 * Định dạng số kiểu vi: '.' phân cách hàng nghìn, ',' là dấu thập phân, tối đa 2 chữ số lẻ làm tròn nửa xa số 0,
 * số nguyên không hiện phần lẻ. null, undefined, NaN hoặc Infinity → '-'. (VI)
 */
export const formatNumber = (value: number | null | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : EMPTY

/**
 * Formats an amount as a plain vi-style number, without any currency symbol or code. Empty or invalid → '-'. (EN)
 *
 * Định dạng số tiền thành số kiểu vi, không kèm ký hiệu hay mã tiền tệ. Rỗng hoặc không hợp lệ → '-'. (VI)
 */
export const formatMoney = (amount: number | null | undefined): string => formatNumber(amount)

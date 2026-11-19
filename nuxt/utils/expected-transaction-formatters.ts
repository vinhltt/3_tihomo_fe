import type { ApiError } from '~/types/api'
import { ExpectedTransactionDisplayStatus, ExpectedTransactionStatus, RecurringTransactionType } from '~/types/recurring-transaction'
import type { ExpectedTransactionViewModel } from '~/types/recurring-transaction'
import { formatDate as formatDisplayDate, formatDateTime as formatDisplayDateTime, formatMoney } from '~/utils/display-format'

/**
 * A display label: a translation key (with params and an optional plural count), or a backend value shown verbatim. (EN)
 *
 * Nhãn hiển thị: key dịch (kèm params và số đếm số nhiều nếu có), hoặc giá trị backend hiển thị nguyên văn. (VI)
 */
export type DisplayLabel = { key: string; params?: Record<string, unknown>; plural?: number } | { raw: string }

const TIMESTAMP_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const calendarDatePattern = /^\d{4}-\d{2}-\d{2}/
const timestampZonePattern = /([zZ]|[+-]\d{2}:\d{2})$/

/**
 * Formats an amount as a plain vi-style number without a currency symbol. Empty or invalid → '-'. (EN)
 *
 * Định dạng số tiền thành số kiểu vi, không kèm ký hiệu tiền tệ. Rỗng hoặc không hợp lệ → '-'. (VI)
 */
export const formatCurrency = (amount: number | null | undefined): string => formatMoney(amount)

/**
 * Formats the calendar date at the start of the value as yyyy/MM/dd from its digits, never shifted through a timezone.
 * Empty or unparseable → '-'. (EN)
 *
 * Định dạng ngày lịch ở đầu chuỗi thành yyyy/MM/dd theo chữ số, không đổi qua múi giờ. Rỗng hoặc không đọc được → '-'. (VI)
 */
export const formatDate = (value: string | null | undefined): string => formatDisplayDate(calendarDatePattern.exec(value ?? '')?.[0])

/**
 * Formats a backend timestamp as yyyy/MM/dd HH:mm in Asia/Ho_Chi_Minh; a value without a zone is read as UTC.
 * Empty or unparseable → '-'. (EN)
 *
 * Định dạng mốc thời gian backend thành yyyy/MM/dd HH:mm theo Asia/Ho_Chi_Minh; chuỗi không có múi giờ được đọc là UTC.
 * Rỗng hoặc không đọc được → '-'. (VI)
 */
export const formatTimestamp = (value: string | null | undefined): string => {
  if (!value) return formatDisplayDateTime(value)
  // GeneratedAt/ProcessedAt are UTC; PostgreSQL returns them without a zone.
  return formatDisplayDateTime(new Date(timestampZonePattern.test(value) ? value : `${value}Z`), { timeZone: TIMESTAMP_TIME_ZONE })
}

/**
 * Converts a caught error to the display error shape: a frontend message keeps its messageKey, a backend message is
 * kept verbatim, and an error with neither falls back to fallbackKey. (EN)
 *
 * Chuyển lỗi bắt được sang dạng lỗi hiển thị: thông báo FE giữ messageKey, thông báo backend giữ nguyên văn, lỗi không
 * có cả hai dùng fallbackKey. (VI)
 */
export const errorMessage = (error: unknown, fallbackKey: string): Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> => {
  const apiError = error as Partial<ApiError> | null
  if (apiError?.messageKey) {
    return { messageKey: apiError.messageKey, messageParams: apiError.messageParams, message: apiError.message ?? '' }
  }
  return apiError?.message ? { message: apiError.message } : { messageKey: fallbackKey, message: fallbackKey }
}

/**
 * Label of the period's template: its name verbatim, or a key when the template is gone or was never linked. (EN)
 *
 * Nhãn mẫu của kỳ: tên mẫu nguyên văn, hoặc key khi mẫu không còn hoặc chưa từng gắn. (VI)
 */
export const templateLabel = (transaction: ExpectedTransactionViewModel): DisplayLabel => {
  if (transaction.templateName) return { raw: transaction.templateName }
  return transaction.recurringTransactionTemplateId ? { key: 'expected.template.unavailable' } : { key: 'expected.template.none' }
}

/**
 * Label of a display status; an empty or unmapped value is shown verbatim. (EN)
 *
 * Nhãn trạng thái hiển thị; giá trị rỗng hoặc không có trong map hiển thị nguyên văn. (VI)
 */
export const statusLabel = (status: ExpectedTransactionDisplayStatus): DisplayLabel => {
  switch (status) {
    case ExpectedTransactionDisplayStatus.Pending: return { key: 'enums.expectedTransactionStatus.pending' }
    case ExpectedTransactionDisplayStatus.Overdue: return { key: 'enums.expectedTransactionStatus.overdue' }
    case ExpectedTransactionDisplayStatus.Confirmed: return { key: 'enums.expectedTransactionStatus.confirmed' }
    case ExpectedTransactionDisplayStatus.Cancelled: return { key: 'enums.expectedTransactionStatus.cancelled' }
    case ExpectedTransactionDisplayStatus.Completed: return { key: 'enums.expectedTransactionStatus.completed' }
    default: return { raw: String(status ?? '') }
  }
}

export const statusClass = (status: ExpectedTransactionDisplayStatus): string => {
  switch (status) {
    case ExpectedTransactionDisplayStatus.Pending: return 'badge-outline-primary'
    case ExpectedTransactionDisplayStatus.Overdue: return 'badge-outline-danger'
    case ExpectedTransactionDisplayStatus.Confirmed: return 'badge-outline-success'
    case ExpectedTransactionDisplayStatus.Cancelled: return 'badge-outline-secondary'
    case ExpectedTransactionDisplayStatus.Completed: return 'badge-outline-info'
    default: return 'badge-outline-secondary'
  }
}

/**
 * Label of a transaction type; an empty or unmapped value is shown verbatim. (EN)
 *
 * Nhãn loại giao dịch; giá trị rỗng hoặc không có trong map hiển thị nguyên văn. (VI)
 */
export const typeLabel = (type: RecurringTransactionType): DisplayLabel => {
  switch (type) {
    case RecurringTransactionType.Income: return { key: 'enums.transactionType.income' }
    case RecurringTransactionType.Expense: return { key: 'enums.transactionType.expense' }
    case RecurringTransactionType.Transfer: return { key: 'enums.transactionType.transfer' }
    default: return { raw: String(type ?? '') }
  }
}

/**
 * Due-state label from daysUntilDue: overdue or remaining days (pluralised by the day count), or due today. (EN)
 *
 * Nhãn trạng thái hạn từ daysUntilDue: quá hạn hoặc còn bao nhiêu ngày (số nhiều theo số ngày), hoặc đến hạn hôm nay. (VI)
 */
export const dueMessage = (days: number): DisplayLabel => {
  if (days < 0) return { key: 'expected.due.overdue', params: { days: Math.abs(days) }, plural: Math.abs(days) }
  if (days === 0) return { key: 'expected.due.today' }
  return { key: 'expected.due.remaining', params: { days }, plural: days }
}

export const isIncomeExpense = (transaction: ExpectedTransactionViewModel): boolean =>
  transaction.transactionType === RecurringTransactionType.Income || transaction.transactionType === RecurringTransactionType.Expense

export const isPending = (transaction: ExpectedTransactionViewModel): boolean =>
  transaction.status === ExpectedTransactionStatus.Pending &&
  (transaction.displayStatus === ExpectedTransactionDisplayStatus.Pending || transaction.displayStatus === ExpectedTransactionDisplayStatus.Overdue)

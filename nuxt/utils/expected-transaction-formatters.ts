import type { ApiError } from '~/types/api'
import { ExpectedTransactionDisplayStatus, ExpectedTransactionStatus, RecurringTransactionType } from '~/types/recurring-transaction'
import type { ExpectedTransactionViewModel } from '~/types/recurring-transaction'

const currencyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
const timestampFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
const timestampZonePattern = /([zZ]|[+-]\d{2}:\d{2})$/

export const formatCurrency = (amount: number): string => currencyFormatter.format(amount)

// Calendar dates are rendered from their digits, never shifted through a timezone.
export const formatDate = (value: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

export const formatTimestamp = (value: string): string => {
  // GeneratedAt/ProcessedAt are UTC; PostgreSQL returns them without a zone.
  const date = new Date(timestampZonePattern.test(value) ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? value : timestampFormatter.format(date)
}

export const errorMessage = (error: unknown, fallback: string): string => (error as Partial<ApiError> | null)?.message || fallback

export const templateLabel = (transaction: ExpectedTransactionViewModel): string =>
  transaction.templateName || (transaction.recurringTransactionTemplateId ? 'Mẫu không còn khả dụng' : 'Không gắn mẫu')

export const statusLabel = (status: ExpectedTransactionDisplayStatus): string => {
  switch (status) {
    case ExpectedTransactionDisplayStatus.Pending: return 'Chờ xử lý'
    case ExpectedTransactionDisplayStatus.Overdue: return 'Quá hạn'
    case ExpectedTransactionDisplayStatus.Confirmed: return 'Đã xác nhận'
    case ExpectedTransactionDisplayStatus.Cancelled: return 'Đã hủy'
    case ExpectedTransactionDisplayStatus.Completed: return 'Hoàn thành'
    default: return 'Trạng thái không được hỗ trợ'
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

export const typeLabel = (type: RecurringTransactionType): string => {
  switch (type) {
    case RecurringTransactionType.Income: return 'Thu nhập'
    case RecurringTransactionType.Expense: return 'Chi phí'
    case RecurringTransactionType.Transfer: return 'Chuyển khoản'
    default: return 'Loại giao dịch không được hỗ trợ'
  }
}

export const dueMessage = (days: number): string => days < 0 ? `Quá hạn ${Math.abs(days)} ngày` : days === 0 ? 'Đến hạn hôm nay' : `Còn ${days} ngày`

export const isIncomeExpense = (transaction: ExpectedTransactionViewModel): boolean =>
  transaction.transactionType === RecurringTransactionType.Income || transaction.transactionType === RecurringTransactionType.Expense

export const isPending = (transaction: ExpectedTransactionViewModel): boolean =>
  transaction.status === ExpectedTransactionStatus.Pending &&
  (transaction.displayStatus === ExpectedTransactionDisplayStatus.Pending || transaction.displayStatus === ExpectedTransactionDisplayStatus.Overdue)

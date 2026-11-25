import type { Debt, DebtScheduleMethod } from '~/types/debt'
import type {
  DebtInstallment,
  DebtInstallmentForm,
  DebtInstallmentRequest,
  DebtInstallmentStatus,
  DebtRecalculationForm,
  DebtRecalculationPreview,
  DebtRecalculationRequest,
  DebtScheduleForm,
  DebtScheduleRequest
} from '~/types/debt-schedule'
import { isDebtBusy, toDebtCents } from '~/utils/debt-formatters'

const COUNT_PATTERN = /^\d+$/
const MAX_INSTALLMENTS = 2400
const MANY_INSTALLMENTS = 600

export const DEBT_SCHEDULE_METHOD_KEYS: Record<DebtScheduleMethod, string> = {
  EqualPrincipal: 'debts.scheduleMethod.equalPrincipal',
  EqualPayment: 'debts.scheduleMethod.equalPayment'
}

export const DEBT_INSTALLMENT_STATUS_KEYS: Record<DebtInstallmentStatus, string> = {
  Pending: 'enums.expectedTransactionStatus.pending',
  Confirmed: 'enums.expectedTransactionStatus.confirmed',
  Cancelled: 'enums.expectedTransactionStatus.cancelled',
  Completed: 'enums.expectedTransactionStatus.completed'
}

export const debtInstallmentStatusClass = (status: DebtInstallmentStatus): string => {
  switch (status) {
    case 'Pending': return 'badge-outline-primary'
    case 'Confirmed': return 'badge-outline-success'
    case 'Completed': return 'badge-outline-info'
    default: return 'badge-outline-secondary'
  }
}

// A settled or closed debt keeps its schedule for reading only, and a provisioning debt has none.
export const hasScheduleActions = (debt: Debt): boolean => debt.status === 'Active'

// Creating, recalculating, adjusting and recording from an installment all need the same state.
export const canWriteSchedule = (debt: Debt): boolean => !isDebtBusy(debt) && hasScheduleActions(debt)

// Not processed yet, and held by no payment. A payment that waits to be synced holds it as well.
export const isOpenInstallment = (installment: DebtInstallment): boolean => installment.status === 'Pending' && !installment.payment

/**
 * Whether a pending installment is past its due day; today is the calendar day (YYYY-MM-DD) in Asia/Ho_Chi_Minh. (EN)
 *
 * Kỳ chờ đã quá ngày hạn hay chưa; today là ngày lịch (YYYY-MM-DD) ở Asia/Ho_Chi_Minh. (VI)
 */
export const isOverdueInstallment = (installment: DebtInstallment, today: string): boolean => installment.status === 'Pending' && installment.dueDate < today

/**
 * Reads the typed number of installments: a whole number from 1 to 2400, or the key of its problem. A large number has the
 * key of a warning, which stops nothing. (EN)
 *
 * Đọc số kỳ đã nhập: số nguyên từ 1 đến 2400, hoặc key của lỗi. Số lớn có key cảnh báo và không chặn gì. (VI)
 */
export const readInstallmentCount = (text: string): { count: number | null; errorKey: string | null; warningKey: string | null } => {
  const count = COUNT_PATTERN.test(text) ? Number(text) : 0
  return count >= 1 && count <= MAX_INSTALLMENTS
    ? { count, errorKey: null, warningKey: count > MANY_INSTALLMENTS ? 'debts.schedule.periods_over_600_warning' : null }
    : { count: null, errorKey: 'debts.validation.installmentCount', warningKey: null }
}

export const toScheduleForm = (): DebtScheduleForm => ({ method: 'EqualPrincipal', firstDueDate: '', installmentCount: '' })

/**
 * Key of the first problem of a new schedule, or null. (EN)
 *
 * Key của lỗi đầu tiên trong lịch mới, hoặc null. (VI)
 */
export const debtScheduleError = (form: DebtScheduleForm): string | null =>
  form.firstDueDate ? readInstallmentCount(form.installmentCount).errorKey : 'debts.validation.dueDate'

export const toScheduleRequest = (form: DebtScheduleForm): DebtScheduleRequest => ({
  method: form.method,
  firstDueDate: form.firstDueDate,
  installmentCount: readInstallmentCount(form.installmentCount).count
})

export const toRecalculationForm = (preview: DebtRecalculationPreview): DebtRecalculationForm => ({
  installmentCount: String(preview.installmentCount ?? ''),
  nextDueDate: preview.nextDueDate ?? ''
})

// The server then only takes the pending installments back, and creates none.
export const isNothingLeft = (preview: DebtRecalculationPreview): boolean => preview.balance === 0

/**
 * Key of the first problem of a recalculation, or null. (EN)
 *
 * Key của lỗi đầu tiên trong việc tính lại, hoặc null. (VI)
 */
export const debtRecalculationError = (form: DebtRecalculationForm, preview: DebtRecalculationPreview): string | null => {
  if (isNothingLeft(preview)) return null
  return readInstallmentCount(form.installmentCount).errorKey ?? (form.nextDueDate ? null : 'debts.validation.dueDate')
}

/**
 * Request of a recalculation of exactly the schedule that was previewed. (EN)
 *
 * Yêu cầu tính lại đúng lịch đã xem trước. (VI)
 */
export const toRecalculationRequest = (form: DebtRecalculationForm, preview: DebtRecalculationPreview): DebtRecalculationRequest => ({
  ...(isNothingLeft(preview) ? {} : { installmentCount: readInstallmentCount(form.installmentCount).count, nextDueDate: form.nextDueDate }),
  expectedVersion: preview.version
})

export const toInstallmentForm = (installment: DebtInstallment): DebtInstallmentForm => ({
  principal: String(installment.principal),
  interest: String(installment.interest),
  reason: ''
})

/**
 * Key of the first problem of a change by hand, or null. (EN)
 *
 * Key của lỗi đầu tiên khi chỉnh tay một kỳ, hoặc null. (VI)
 */
export const debtInstallmentError = (form: DebtInstallmentForm): string | null => {
  const principal = toDebtCents(form.principal)
  const interest = toDebtCents(form.interest)
  if (principal === null) return 'debts.validation.principal'
  if (interest === null) return 'debts.validation.interest'
  if (principal + interest === 0) return 'debts.validation.paymentTotal'
  return form.reason.trim() ? null : 'common.validation.required'
}

export const toInstallmentRequest = (form: DebtInstallmentForm): DebtInstallmentRequest => ({
  principal: Number(form.principal),
  interest: Number(form.interest),
  reason: form.reason.trim()
})

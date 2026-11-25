import type { FilterRequest } from '~/types/api'
import { FilterLogicalOperator, FilterType } from '~/types/api'
import type { Debt, DebtDialog, DebtPayment, DebtPaymentForm, DebtPaymentRequest, DebtPaymentStatus } from '~/types/debt'
import type { DebtInstallment } from '~/types/debt-schedule'
import type { TransactionViewModel } from '~/types/transaction'
import { formatDebtAmount, isDebtBusy, toDebtCents, todayInVietnam, transactionAmountText } from '~/utils/debt-formatters'
import { formatTimestamp } from '~/utils/expected-transaction-formatters'

export const DEBT_PAYMENT_STATUS_KEYS: Record<DebtPaymentStatus, string> = {
  Pending: 'debts.paymentStatus.pending',
  Applied: 'debts.paymentStatus.applied',
  CountedInInitialBalance: 'debts.paymentStatus.countedInInitialBalance',
  Cancelled: 'debts.paymentStatus.cancelled'
}

export const debtPaymentStatusClass = (status: DebtPaymentStatus): string => {
  switch (status) {
    case 'Pending': return 'badge-outline-warning'
    case 'Applied': return 'badge-outline-success'
    case 'CountedInInitialBalance': return 'badge-outline-info'
    default: return 'badge-outline-secondary'
  }
}

export const canRecordPayment = (debt: Debt): boolean => !isDebtBusy(debt) && debt.status === 'Active'

// A closed debt keeps its payments for good, and a provisioning debt has none.
export const hasPaymentActions = (debt: Debt): boolean => ['Active', 'Settled'].includes(debt.status)

export const canCancelPayment = (debt: Debt, payment: DebtPayment): boolean => !isDebtBusy(debt) && hasPaymentActions(debt) && payment.status !== 'Cancelled'

export const canResyncPayment = (debt: Debt, payment: DebtPayment): boolean => !isDebtBusy(debt) && hasPaymentActions(debt) && payment.status === 'Pending'

/**
 * Filter of the transactions that can be linked: one-sided ones of the given accounts, outgoing or incoming. (EN)
 *
 * Bộ lọc giao dịch liên kết được: giao dịch một chiều, chi hoặc thu, của các tài khoản được đưa. (VI)
 */
export const debtTransactionFilter = (accountIds: string[], outgoing: boolean): FilterRequest => ({
  logicalOperator: FilterLogicalOperator.And,
  details: [
    { attributeName: 'accountId', filterType: FilterType.In, value: accountIds.join('|') },
    { attributeName: outgoing ? 'spentAmount' : 'revenueAmount', filterType: FilterType.GreaterThan, value: '0' },
    { attributeName: outgoing ? 'revenueAmount' : 'spentAmount', filterType: FilterType.Equal, value: '0' }
  ]
})

/**
 * Form of a payment today: with the expected amounts of the given installment, or all of it principal outside the
 * schedule. (EN)
 *
 * Form thanh toán hôm nay: lấy số dự kiến của kỳ được đưa, hoặc toàn bộ là gốc khi ngoài lịch. (VI)
 */
export const toPaymentForm = (installment: DebtInstallment | null = null): DebtPaymentForm => ({
  mode: 'create',
  principal: String(installment?.principal ?? ''),
  interest: String(installment?.interest ?? 0),
  accountId: '',
  paymentDate: todayInVietnam(),
  transaction: null,
  countedInInitialBalance: false,
  ...(installment ? { installmentId: installment.id } : {})
})

/**
 * What picking a transaction puts into the form: all of it principal, and counted in the initial balance when its calendar
 * day is before the day the debt was entered and a part was already paid then. (EN)
 *
 * Điều việc chọn giao dịch đưa vào form: toàn bộ là gốc, và đã tính trong dư nợ ban đầu khi ngày lịch của giao dịch trước
 * ngày tạo khoản và lúc đó đã trả một phần. (VI)
 */
export const pickedTransactionFields = (debt: Debt, transaction: TransactionViewModel): Partial<DebtPaymentForm> => ({
  transaction,
  principal: transactionAmountText(transaction),
  interest: '0',
  countedInInitialBalance:
    debt.originalAmount > debt.initialBalance &&
    transaction.transactionDate.slice(0, 10) < formatTimestamp(debt.createdAt).slice(0, 10).replaceAll('/', '-')
})

/**
 * What picking a transaction puts into the form of an installment: the expected interest when the amount covers it and the
 * rest as principal, otherwise all of it principal. It is never counted in the initial balance. (EN)
 *
 * Điều việc chọn giao dịch đưa vào form của một kỳ: lãi dự kiến khi số tiền đủ lãi và phần còn lại là gốc, nếu không thì toàn
 * bộ là gốc. Không bao giờ tính là đã nằm trong dư nợ ban đầu. (VI)
 */
export const pickedInstallmentFields = (installment: DebtInstallment, transaction: TransactionViewModel): Partial<DebtPaymentForm> => {
  const amount = transactionAmountText(transaction)
  const interest = String(installment.interest)
  // An amount without exact cents is never split.
  const rest = (toDebtCents(amount) ?? -1) - (toDebtCents(interest) ?? Infinity)
  return {
    transaction,
    ...(rest >= 0 ? { principal: String(rest / 100), interest } : { principal: amount, interest: '0' }),
    countedInInitialBalance: false
  }
}

/**
 * Key of the first problem of the payment, or null. The sums are in cents. (EN)
 *
 * Key của lỗi đầu tiên trong thanh toán, hoặc null. Tổng được tính bằng xu. (VI)
 */
export const debtPaymentError = (form: DebtPaymentForm): string | null => {
  const principal = toDebtCents(form.principal)
  const interest = toDebtCents(form.interest || '0')
  if (principal === null) return 'debts.validation.principal'
  if (interest === null) return 'debts.validation.interest'
  if (principal + interest === 0) return 'debts.validation.paymentTotal'
  if (form.mode === 'create') {
    if (!form.accountId) return 'debts.validation.paymentAccount'
    return form.paymentDate ? null : 'debts.validation.paymentDate'
  }
  if (!form.transaction) return 'debts.validation.transaction'
  return principal + interest === toDebtCents(transactionAmountText(form.transaction)) ? null : 'debts.validation.transactionTotal'
}

/**
 * Request of the payment, without the key of its attempt. (EN)
 *
 * Yêu cầu ghi nhận thanh toán, chưa kèm khóa của lần ghi nhận. (VI)
 */
export const toPaymentRequest = (form: DebtPaymentForm): DebtPaymentRequest => ({
  principal: Number(form.principal),
  interest: Number(form.interest || '0'),
  ...(form.installmentId ? { installmentId: form.installmentId } : {}),
  ...(form.mode === 'create'
    ? { accountId: form.accountId, paymentDate: form.paymentDate }
    : { transactionId: form.transaction?.id ?? null, countedInInitialBalance: form.countedInInitialBalance })
})

/**
 * A new random UUID. crypto.randomUUID is missing on a page served over plain http; getRandomValues never is. (EN)
 *
 * UUID ngẫu nhiên mới. crypto.randomUUID không có trên trang mở bằng http thường; getRandomValues thì luôn có. (VI)
 */
export const newAttemptKey = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return hex.replace(/^(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-')
}

/**
 * Cancellation dialog of a payment; the principal only goes back when it was taken off the balance. (EN)
 *
 * Hộp xác nhận hủy thanh toán; chỉ cộng lại phần gốc khi phần gốc đã được trừ vào dư nợ. (VI)
 */
export const debtCancelPaymentDialog = (payment: DebtPayment): DebtDialog => ({
  titleKey: 'debts.cancelPayment.title',
  titleParams: { principal: formatDebtAmount(payment.principal), interest: formatDebtAmount(payment.interest) },
  textKey: payment.status === 'Applied' ? 'debts.cancelPayment.principalReturned' : 'debts.cancelPayment.balanceUnchanged',
  textParams: { principal: formatDebtAmount(payment.principal) },
  confirmKey: 'debts.cancelPayment.action'
})

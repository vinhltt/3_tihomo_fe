import type { ApiError, FilterRequest } from '~/types/api'
import { FilterLogicalOperator, FilterType } from '~/types/api'
import type {
  Debt,
  DebtDialog,
  DebtDirection,
  DebtDisbursementPreview,
  DebtForm,
  DebtPayment,
  DebtPaymentForm,
  DebtPaymentRequest,
  DebtPaymentStatus,
  DebtPendingOperation,
  DebtStatus,
  DebtTransactionMode,
  DebtType
} from '~/types/debt'
import { getAmount } from '~/types/transaction'
import type { TransactionViewModel } from '~/types/transaction'
import { formatDate, formatMoney } from '~/utils/display-format'
import { formatTimestamp } from '~/utils/expected-transaction-formatters'
import type { DisplayLabel } from '~/utils/expected-transaction-formatters'

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/
const MAX_RATE_HUNDREDTHS = 10000

export const DEBT_DIRECTION_KEYS: Record<DebtDirection, string> = {
  Borrow: 'debts.direction.borrow',
  Lend: 'debts.direction.lend'
}

export const DEBT_STATUS_KEYS: Record<DebtStatus, string> = {
  Provisioning: 'debts.status.provisioning',
  Active: 'debts.status.active',
  Settled: 'debts.status.settled',
  Closed: 'debts.status.closed'
}

export const DEBT_TYPE_KEYS: Record<DebtType, string> = {
  PersonalLoan: 'debts.type.personalLoan',
  Mortgage: 'debts.type.mortgage',
  CarLoan: 'debts.type.carLoan',
  StudentLoan: 'debts.type.studentLoan',
  BusinessLoan: 'debts.type.businessLoan',
  CreditCard: 'debts.type.creditCard',
  PersonalLending: 'debts.type.personalLending',
  Other: 'debts.type.other'
}

export const DEBT_OPERATION_KEYS: Record<Exclude<DebtPendingOperation, 'None'>, string> = {
  Deleting: 'debts.operation.deleting',
  Closing: 'debts.operation.closing',
  Settling: 'debts.operation.settling',
  Scheduling: 'debts.operation.scheduling',
  Cancelling: 'debts.operation.cancelling',
  Restoring: 'debts.operation.restoring'
}

export const DEBT_PAYMENT_STATUS_KEYS: Record<DebtPaymentStatus, string> = {
  Pending: 'debts.paymentStatus.pending',
  Applied: 'debts.paymentStatus.applied',
  CountedInInitialBalance: 'debts.paymentStatus.countedInInitialBalance',
  Cancelled: 'debts.paymentStatus.cancelled'
}

export const DEBT_TRANSACTION_MODE_KEYS: Record<DebtTransactionMode, string> = {
  create: 'debts.transactionMode.create',
  link: 'debts.transactionMode.link'
}

/**
 * Label of an enum value from its key map; a value that is empty or not in the map is shown verbatim. (EN)
 *
 * Nhãn của giá trị enum theo map key; giá trị rỗng hoặc không có trong map hiển thị nguyên văn. (VI)
 */
export const debtLabel = (keys: Record<string, string>, value: string): DisplayLabel => (keys[value] ? { key: keys[value] } : { raw: String(value ?? '') })

export const debtStatusClass = (status: DebtStatus): string => {
  switch (status) {
    case 'Provisioning': return 'badge-outline-warning'
    case 'Active': return 'badge-outline-primary'
    case 'Settled': return 'badge-outline-success'
    default: return 'badge-outline-secondary'
  }
}

export const debtPaymentStatusClass = (status: DebtPaymentStatus): string => {
  switch (status) {
    case 'Pending': return 'badge-outline-warning'
    case 'Applied': return 'badge-outline-success'
    case 'CountedInInitialBalance': return 'badge-outline-info'
    default: return 'badge-outline-secondary'
  }
}

/**
 * Formats a VND amount as a vi-style number without a unit: a fraction always shows two digits, a whole number none.
 * Empty or invalid → '-'. (EN)
 *
 * Định dạng số tiền VND thành số kiểu vi, không kèm đơn vị: có phần lẻ thì luôn đủ hai chữ số, số nguyên thì không có.
 * Rỗng hoặc không hợp lệ → '-'. (VI)
 */
export const formatDebtAmount = (amount: number | null | undefined): string => formatMoney(amount).replace(/,\d$/, '$&0')

const readCents = (text: string): number | null => {
  if (!AMOUNT_PATTERN.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  const cents = Number(whole + fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

/**
 * Reads a typed amount as whole cents, or null when it is not an amount with at most two decimals or when the JSON number
 * could not carry it: from about 70 trillion on, a double no longer holds every cent. (EN)
 *
 * Đọc số tiền đã nhập thành số xu nguyên, hoặc null khi không phải số tiền tối đa hai chữ số lẻ hoặc khi số JSON không chở
 * được: từ khoảng 70 nghìn tỷ, double không còn giữ đúng từng xu. (VI)
 */
export const toDebtCents = (text: string): number | null => {
  const cents = readCents(text)
  return cents !== null && readCents(String(Number(text))) === cents ? cents : null
}

/**
 * Whether the typed text is an amount of at least 0.01 with at most two decimals. (EN)
 *
 * Chữ đã nhập có phải số tiền từ 0.01, tối đa hai chữ số lẻ hay không. (VI)
 */
export const isValidDebtAmount = (text: string): boolean => (toDebtCents(text) ?? 0) > 0

/**
 * Today as a calendar day (YYYY-MM-DD) in Asia/Ho_Chi_Minh. (EN)
 *
 * Hôm nay theo ngày lịch (YYYY-MM-DD) ở Asia/Ho_Chi_Minh. (VI)
 */
export const todayInVietnam = (): string => formatDate(new Date(), { timeZone: 'Asia/Ho_Chi_Minh' }).replaceAll('/', '-')

/**
 * Types that fit the direction; the first one is the default of a new debt. (EN)
 *
 * Các loại hợp với chiều; loại đầu tiên là mặc định của khoản mới. (VI)
 */
export const debtTypesFor = (direction: DebtDirection): DebtType[] =>
  direction === 'Lend'
    ? ['PersonalLending', 'Other']
    : ['PersonalLoan', 'Mortgage', 'CarLoan', 'StudentLoan', 'BusinessLoan', 'CreditCard', 'Other']

// The server refuses every write except a resync while an operation is unfinished.
export const isDebtBusy = (debt: Debt): boolean => debt.pendingOperation !== 'None'

export const canEditDebt = (debt: Debt): boolean => !isDebtBusy(debt) && ['Active', 'Settled', 'Closed'].includes(debt.status)

export const canCloseDebt = (debt: Debt): boolean => !isDebtBusy(debt) && ['Active', 'Settled'].includes(debt.status)

// Also the cancellation of a provisioning debt.
export const canDeleteDebt = (debt: Debt): boolean =>
  !isDebtBusy(debt) && ['Active', 'Closed', 'Provisioning'].includes(debt.status) && debt.activePaymentCount === 0

export const canRecordPayment = (debt: Debt): boolean => !isDebtBusy(debt) && debt.status === 'Active'

// A closed debt keeps its payments for good, and a provisioning debt has none.
export const hasPaymentActions = (debt: Debt): boolean => ['Active', 'Settled'].includes(debt.status)

export const canCancelPayment = (debt: Debt, payment: DebtPayment): boolean => !isDebtBusy(debt) && hasPaymentActions(debt) && payment.status !== 'Cancelled'

export const canResyncPayment = (debt: Debt, payment: DebtPayment): boolean => !isDebtBusy(debt) && hasPaymentActions(debt) && payment.status === 'Pending'

/**
 * Whether a failed command may still have been carried out: there was no answer, or none that proves a refusal. (EN)
 *
 * Lệnh thất bại có thể vẫn đã được thực hiện hay không: không có câu trả lời, hoặc câu trả lời không chứng minh bị từ chối. (VI)
 */
export const isUnknownOutcome = (error: unknown): boolean => {
  const status = (error as Partial<ApiError> | null)?.statusCode ?? 0
  return status === 0 || status >= 500
}

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

// Debts are in VND only. The code is compared without case.
export const isVndAccount = (account: { currency?: string }): boolean => account.currency?.toUpperCase() === 'VND'

// The amount as the form would hold it; only one side of a linkable transaction is above zero.
export const transactionAmountText = (transaction: TransactionViewModel): string => String(getAmount(transaction))

/**
 * Form of a debt; without one, of a new debt that starts today. (EN)
 *
 * Form của một khoản; không có khoản thì là khoản mới bắt đầu hôm nay. (VI)
 */
export const toDebtForm = (debt: Debt | null): DebtForm => ({
  direction: debt?.direction ?? 'Borrow',
  name: debt?.name ?? '',
  counterparty: debt?.counterparty ?? '',
  debtType: debt?.debtType ?? debtTypesFor('Borrow')[0],
  originalAmount: String(debt?.originalAmount ?? ''),
  initialBalance: String(debt?.initialBalance ?? ''),
  startDate: debt?.startDate ?? todayInVietnam(),
  interestRate: String(debt?.interestRate ?? ''),
  description: debt?.description ?? '',
  notes: debt?.notes ?? '',
  recordDisbursement: false,
  disbursementMode: 'create',
  accountId: '',
  transaction: null
})

/**
 * Key of the first problem of the form, or null. Of a closed debt only the name and the counterparty are checked, because
 * its amounts and rate cannot be typed. (EN)
 *
 * Key của lỗi đầu tiên trong form, hoặc null. Khoản đã đóng chỉ kiểm tên và đối tác, vì số tiền và lãi suất không nhập
 * được. (VI)
 */
export const debtFormError = (form: DebtForm, debt: Debt | null): string | null => {
  if (!form.name.trim() || !form.counterparty.trim()) return 'common.validation.required'
  if (debt?.status === 'Closed') return null
  if (!isValidDebtAmount(form.originalAmount)) return 'debts.validation.originalAmount'
  // Blank means the original amount when creating; when editing there is always a stored value.
  if ((debt || form.initialBalance) && !isValidDebtAmount(form.initialBalance)) return 'debts.validation.initialBalance'
  if ((toDebtCents(form.initialBalance) ?? 0) > (toDebtCents(form.originalAmount) ?? 0)) return 'debts.validation.initialBalanceTooLarge'
  if (form.interestRate && (toDebtCents(form.interestRate) ?? Infinity) > MAX_RATE_HUNDREDTHS) return 'debts.validation.interestRate'
  if (!form.startDate) return 'debts.validation.startDate'
  if (!form.recordDisbursement || form.disbursementMode === 'create') return null
  if (!form.transaction) return 'debts.validation.transaction'
  return toDebtCents(transactionAmountText(form.transaction)) === toDebtCents(form.originalAmount) ? null : 'debts.validation.disbursementAmount'
}

/**
 * Form of a payment outside the schedule: today, and all of it principal. (EN)
 *
 * Form thanh toán ngoài lịch: hôm nay, toàn bộ là gốc. (VI)
 */
export const toPaymentForm = (): DebtPaymentForm => ({
  mode: 'create',
  principal: '',
  interest: '0',
  accountId: '',
  paymentDate: todayInVietnam(),
  transaction: null,
  countedInInitialBalance: false
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
 * Closing dialog; it warns about the permanent lock when payments are still active. (EN)
 *
 * Hộp xác nhận đóng; cảnh báo khóa vĩnh viễn khi còn thanh toán hiệu lực. (VI)
 */
export const debtCloseDialog = (debt: Debt): DebtDialog => ({
  titleKey: 'debts.close.title',
  titleParams: { name: debt.name },
  textKey: debt.activePaymentCount > 0 ? 'debts.close.confirm_permanent_lock' : 'debts.close.confirm',
  textParams: {},
  confirmKey: 'debts.close.action'
})

/**
 * Deletion dialog; it names the disbursement transaction and says whether it is deleted or kept. (EN)
 *
 * Hộp xác nhận xóa; nêu giao dịch giải ngân và việc giao dịch bị xóa hay được giữ lại. (VI)
 */
export const debtDeleteDialog = (debt: Debt, disbursement: DebtDisbursementPreview | null): DebtDialog => {
  const cancels = debt.status === 'Provisioning'
  return {
    titleKey: cancels ? 'debts.delete.cancelTitle' : 'debts.delete.title',
    titleParams: { name: debt.name },
    textKey: !disbursement ? 'debts.delete.noTransaction' : disbursement.willBeDeleted ? 'debts.delete.transactionDeleted' : 'debts.delete.transactionKept',
    textParams: disbursement
      ? { date: formatDate(disbursement.date), account: disbursement.accountName || '-', amount: formatDebtAmount(disbursement.amount) }
      : {},
    confirmKey: cancels ? 'debts.delete.cancelAction' : 'debts.delete.action'
  }
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

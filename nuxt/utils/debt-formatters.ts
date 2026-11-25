import type { DisplayLabel } from '~/utils/expected-transaction-formatters'
import type { Debt, DebtDialog, DebtDirection, DebtDisbursementPreview, DebtForm, DebtPendingOperation, DebtStatus, DebtType } from '~/types/debt'
import { formatDate, formatMoney } from '~/utils/display-format'

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
  accountId: ''
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
  return form.startDate ? null : 'debts.validation.startDate'
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

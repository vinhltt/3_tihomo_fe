import type { ApiError } from './api'

/**
 * Who owes whom: the owner borrowed or lent the money. (EN)
 *
 * Ai nợ ai: chủ khoản đi vay hay cho vay. (VI)
 */
export type DebtDirection = 'Borrow' | 'Lend'

/**
 * Lifecycle status; Provisioning means the disbursement has no clear outcome yet. (EN)
 *
 * Trạng thái vòng đời; Provisioning nghĩa là giải ngân chưa rõ kết quả. (VI)
 */
export type DebtStatus = 'Provisioning' | 'Active' | 'Settled' | 'Closed'

export type DebtType = 'CreditCard' | 'PersonalLoan' | 'Mortgage' | 'CarLoan' | 'StudentLoan' | 'BusinessLoan' | 'Other' | 'PersonalLending'

/**
 * Operation that still has to finish on the server; until then only a resync is accepted. (EN)
 *
 * Thao tác còn phải hoàn tất ở máy chủ; cho đến lúc đó chỉ nhận đồng bộ lại. (VI)
 */
export type DebtPendingOperation = 'None' | 'Deleting' | 'Closing' | 'Settling' | 'Scheduling' | 'Cancelling' | 'Restoring'

export type DebtScheduleMethod = 'EqualPrincipal' | 'EqualPayment'

export type DebtDisbursementOrigin = 'Created' | 'Linked'

/**
 * One debt, in lists and in detail. Amounts are VND; startDate is a calendar day (YYYY-MM-DD). (EN)
 *
 * Một khoản nợ, trong danh sách và trong chi tiết. Số tiền là VND; startDate là ngày lịch (YYYY-MM-DD). (VI)
 */
export type Debt = {
  id: string
  name: string
  description: string | null
  counterparty: string | null
  debtType: DebtType
  direction: DebtDirection
  originalAmount: number
  initialBalance: number
  currentBalance: number
  progress: number
  interestRate: number | null
  startDate: string
  notes: string | null
  status: DebtStatus
  isProvisioning: boolean
  scheduleMethod: DebtScheduleMethod | null
  scheduleVersion: number
  disbursementTransactionId: string | null
  disbursementOrigin: DebtDisbursementOrigin | null
  pendingOperation: DebtPendingOperation
  labelsSyncPending: boolean
  activePaymentCount: number
  hasPendingPayments: boolean
  createdAt: string | null
  updatedAt: string | null
}

/**
 * Outstanding principal of the active debts, one total per direction. (EN)
 *
 * Dư nợ gốc của các khoản đang hoạt động, mỗi chiều một tổng. (VI)
 */
export type DebtTotals = {
  borrowed: number
  lent: number
}

/**
 * Disbursement transaction shown before deleting; willBeDeleted is false when it is kept and unlocked. (EN)
 *
 * Giao dịch giải ngân hiện trước khi xóa; willBeDeleted là false khi giao dịch được giữ lại và mở khóa. (VI)
 */
export type DebtDisbursementPreview = {
  date: string
  accountName: string | null
  amount: number
  willBeDeleted: boolean
}

export type DebtDeletePreview = {
  disbursement: DebtDisbursementPreview | null
}

/**
 * Disbursement of the original amount, recorded together with the debt. (EN)
 *
 * Giải ngân bằng số gốc, ghi nhận cùng khoản. (VI)
 */
export type DebtDisbursementInput = {
  mode: 'create'
  accountId: string
}

type DebtDescriptionRequest = {
  name: string
  description: string | null
  counterparty: string
  debtType: DebtType
  interestRate: number | null
  originalAmount: number
  initialBalance: number | null
  notes: string | null
}

export type DebtCreateRequest = DebtDescriptionRequest & {
  direction: DebtDirection
  startDate: string
  disbursement: DebtDisbursementInput | null
}

/**
 * Edits a debt. The direction and the start date are not part of the request. (EN)
 *
 * Sửa khoản nợ. Chiều và ngày bắt đầu không nằm trong yêu cầu. (VI)
 */
export type DebtUpdateRequest = DebtDescriptionRequest

/**
 * What the form holds. Amounts and the rate stay as the typed text until they are sent. (EN)
 *
 * Nội dung form. Số tiền và lãi suất giữ nguyên chữ đã nhập cho đến khi gửi. (VI)
 */
export type DebtForm = {
  direction: DebtDirection
  name: string
  counterparty: string
  debtType: DebtType
  originalAmount: string
  initialBalance: string
  startDate: string
  interestRate: string
  description: string
  notes: string
  recordDisbursement: boolean
  accountId: string
}

export type DebtFilterForm = {
  direction: '' | DebtDirection
  status: '' | DebtStatus
}

/**
 * Keys and params of a confirmation dialog; the component translates them when the dialog opens. (EN)
 *
 * Key và tham số của hộp xác nhận; component dịch khi mở hộp. (VI)
 */
export type DebtDialog = {
  titleKey: string
  titleParams: Record<string, unknown>
  textKey: string
  textParams: Record<string, unknown>
  confirmKey: string
}

export type DebtDisplayError = Pick<ApiError, 'messageKey' | 'messageParams' | 'message'>

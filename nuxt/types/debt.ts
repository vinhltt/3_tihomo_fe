import type { ApiError } from './api'
import type { TransactionViewModel } from './transaction'

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
 * How money is recorded: with a new transaction, or with one that already exists. (EN)
 *
 * Cách ghi nhận tiền: bằng giao dịch mới, hoặc bằng giao dịch có sẵn. (VI)
 */
export type DebtTransactionMode = 'create' | 'link'

/**
 * Status of a payment; Pending means that it still waits to be synced and the balance does not count it. (EN)
 *
 * Trạng thái thanh toán; Pending nghĩa là còn chờ đồng bộ và dư nợ chưa tính. (VI)
 */
export type DebtPaymentStatus = 'Pending' | 'Applied' | 'CountedInInitialBalance' | 'Cancelled'

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
 * One payment of a debt. paymentDate is a calendar day, null until the day of a linked transaction is known;
 * pendingOperation is set while its cancellation is unfinished. (EN)
 *
 * Một thanh toán của khoản nợ. paymentDate là ngày lịch, null cho tới khi biết ngày của giao dịch liên kết;
 * pendingOperation có giá trị khi chưa hủy xong thanh toán. (VI)
 */
export type DebtPayment = {
  id: string
  principal: number
  interest: number
  paymentDate: string | null
  status: DebtPaymentStatus
  countedInInitialBalance: boolean
  transactionId: string | null
  installmentId: string | null
  accountId: string | null
  pendingOperation: DebtPendingOperation | null
  createdAt: string | null
}

/**
 * Status of an installment; Confirmed means that its payment is recorded. (EN)
 *
 * Trạng thái kỳ; Confirmed nghĩa là đã ghi nhận thanh toán của kỳ. (VI)
 */
export type DebtInstallmentStatus = 'Pending' | 'Confirmed' | 'Cancelled' | 'Completed'

/**
 * One installment with its live payment. The amounts are the expected ones, the original amounts those before the first
 * change by hand; dueDate is a calendar day (YYYY-MM-DD). (EN)
 *
 * Một kỳ kèm thanh toán còn hiệu lực. Các số tiền là số dự kiến, số original là số trước lần chỉnh tay đầu tiên; dueDate là
 * ngày lịch (YYYY-MM-DD). (VI)
 */
export type DebtInstallment = {
  id: string
  scheduleVersion: number
  installmentNo: number
  dueDate: string
  principal: number
  interest: number
  amount: number
  originalPrincipal: number | null
  originalInterest: number | null
  isAdjusted: boolean
  adjustmentReason: string | null
  status: DebtInstallmentStatus
  cancelledBySettlement: boolean
  payment: DebtPayment | null
}

export type DebtSchedule = { version: number; installments: DebtInstallment[] }

/**
 * What a recalculation starts from: version goes back as the expected version, pendingPrincipal is already left out of the
 * balance, and the two defaults are null when the owner has to enter them. (EN)
 *
 * Điểm xuất phát của việc tính lại: version được gửi lại làm phiên bản mong đợi, pendingPrincipal đã trừ khỏi balance, và hai
 * giá trị mặc định là null khi chủ khoản phải nhập. (VI)
 */
export type DebtRecalculationPreview = {
  version: number
  balance: number
  pendingPrincipal: number
  replacedCount: number
  adjustedCount: number
  installmentCount: number | null
  nextDueDate: string | null
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
export type DebtDisbursementInput = { mode: 'create'; accountId: string } | { mode: 'link'; transactionId: string | null }

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
  disbursementMode: DebtTransactionMode
  accountId: string
  transaction: TransactionViewModel | null
}

/**
 * What the payment dialog holds. Only the fields of the chosen mode are sent; installmentId is set when the payment settles
 * an installment. (EN)
 *
 * Nội dung hộp thoại thanh toán. Chỉ gửi các field của cách đã chọn; installmentId có giá trị khi thanh toán xử lý một
 * kỳ. (VI)
 */
export type DebtPaymentForm = {
  mode: DebtTransactionMode
  principal: string
  interest: string
  accountId: string
  paymentDate: string
  transaction: TransactionViewModel | null
  countedInInitialBalance: boolean
  installmentId?: string
}

/**
 * Records a payment; the key of the attempt is added when it is sent. (EN)
 *
 * Ghi nhận thanh toán; khóa của lần ghi nhận được thêm khi gửi. (VI)
 */
export type DebtPaymentRequest = {
  principal: number
  interest: number
  installmentId?: string
} & ({ accountId: string; paymentDate: string } | { transactionId: string | null; countedInInitialBalance: boolean })

/**
 * What the schedule dialogs hold. Numbers stay as the typed text until they are sent. (EN)
 *
 * Nội dung các hộp thoại lịch. Số giữ nguyên chữ đã nhập cho đến khi gửi. (VI)
 */
export type DebtScheduleForm = { method: DebtScheduleMethod; firstDueDate: string; installmentCount: string }

export type DebtRecalculationForm = { installmentCount: string; nextDueDate: string }

export type DebtInstallmentForm = { principal: string; interest: string; reason: string }

export type DebtScheduleRequest = { method: DebtScheduleMethod; firstDueDate: string; installmentCount: number | null }

/**
 * Replaces the installments that are not processed yet. The number and the day are left out when nothing is left to pay. (EN)
 *
 * Thay các kỳ chưa xử lý. Không gửi số kỳ và ngày khi không còn gì để trả. (VI)
 */
export type DebtRecalculationRequest = { installmentCount?: number | null; nextDueDate?: string; expectedVersion: number }

export type DebtInstallmentRequest = { principal: number; interest: number; reason: string }

/**
 * Dialogs of the detail screen; it shows one of them at a time. (EN)
 *
 * Các hộp thoại của màn hình chi tiết; mỗi lúc chỉ hiện một hộp. (VI)
 */
export type DebtDetailDialog = 'edit' | 'pay' | 'createSchedule' | 'recalculate' | 'adjust'

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

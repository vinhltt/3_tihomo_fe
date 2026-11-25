// Transaction Direction enum theo design document mới
export const TransactionDirectionConst = {
  Revenue: 1,
  Spent: 2
} as const

export type TransactionDirectionType = typeof TransactionDirectionConst[keyof typeof TransactionDirectionConst]

// Category Type enum khớp với backend
export const CategoryTypeConst = {
  Income: 0,
  Expense: 1,
  Transfer: 2,
  Fee: 3,
  Other: 4
} as const

export type CategoryType = typeof CategoryTypeConst[keyof typeof CategoryTypeConst]

// Transaction ViewModel - sử dụng cấu trúc backend hiện tại
export type TransactionViewModel = {
  id: string
  accountId: string
  userId?: string
  transactionDate: string
  revenueAmount: number
  spentAmount: number
  description?: string
  balance: number
  balanceCompare?: number
  availableLimit?: number
  availableLimitCompare?: number
  transactionCode?: string
  syncMisa: boolean
  syncSms: boolean
  vn: boolean
  categorySummary?: string
  note?: string
  importFrom?: string
  increaseCreditLimit?: number
  usedPercent?: number
  categoryType: CategoryType
  group?: string
  createAt?: string
  updateAt?: string
  createBy?: string
  updateBy?: string
  debtId?: string | null
  /**
   * Set while the transaction is linked to a debt: its amounts, account, date and owner are then locked. (EN)
   *
   * Có giá trị khi giao dịch đang gắn khoản nợ: số tiền, tài khoản, ngày và chủ sở hữu khi đó bị khóa. (VI)
   */
  debtLinkId?: string | null
  debtLinkKind?: 'Payment' | 'Disbursement' | null
  debtLinkPermanent?: boolean | null
}

// Frontend Request với TransactionDirectionConst và Amount đơn
export type TransactionCreateRequest = {
  accountId: string
  userId?: string
  transactionDate: string
  transactionDirection: TransactionDirectionType
  amount: number
  description?: string
  balance?: number
  balanceCompare?: number
  availableLimit?: number
  availableLimitCompare?: number
  transactionCode?: string
  syncMisa?: boolean
  syncSms?: boolean
  vn?: boolean
  categorySummary?: string
  note?: string
  importFrom?: string
  increaseCreditLimit?: number
  usedPercent?: number
  categoryType: CategoryType
  group?: string
}

export type TransactionUpdateRequest = {
  id: string
  accountId: string
  userId?: string
  transactionDate: string
  transactionDirection: TransactionDirectionType
  amount: number
  description?: string
  balance?: number
  balanceCompare?: number
  availableLimit?: number
  availableLimitCompare?: number
  transactionCode?: string
  syncMisa?: boolean
  syncSms?: boolean
  vn?: boolean
  categorySummary?: string
  note?: string
  importFrom?: string
  increaseCreditLimit?: number
  usedPercent?: number
  categoryType: CategoryType
  group?: string
}

// Computed property để hiển thị số tiền với dấu +/-
export type TransactionDisplayViewModel = TransactionViewModel & {
  displayAmount: string
  isRevenue: boolean
  amountClass: string
}

// Filter cho Transaction
export type TransactionFilter = {
  accountId?: string
  transactionDirection?: TransactionDirectionType
  startDate?: string
  endDate?: string
  categoryType?: CategoryType
}

// Helper functions
export const formatDisplayAmount = (transaction: TransactionViewModel): string => {
  if (transaction.revenueAmount > 0) {
    return `+${transaction.revenueAmount.toLocaleString('vi-VN')} ₫`
  }
  if (transaction.spentAmount > 0) {
    return `-${transaction.spentAmount.toLocaleString('vi-VN')} ₫`
  }
  return '0 ₫'
}

export const getAmountClass = (transaction: TransactionViewModel): string => {
  if (transaction.revenueAmount > 0) return 'text-success'
  if (transaction.spentAmount > 0) return 'text-danger'
  return 'text-dark'
}

export const getTransactionDirection = (transaction: TransactionViewModel): TransactionDirectionType => {
  return transaction.revenueAmount > 0 ? TransactionDirectionConst.Revenue : TransactionDirectionConst.Spent
}

export const getAmount = (transaction: TransactionViewModel): number => {
  return transaction.revenueAmount > 0 ? transaction.revenueAmount : transaction.spentAmount
}

// Convert frontend request to backend format
export const convertToBackendRequest = (frontendRequest: TransactionCreateRequest): any => {
  const backendRequest = {
    ...frontendRequest,
    // Convert datetime-local format to ISO string for backend
    transactionDate: new Date(frontendRequest.transactionDate).toISOString(),
    revenueAmount: frontendRequest.transactionDirection === TransactionDirectionConst.Revenue ? frontendRequest.amount : 0,
    spentAmount: frontendRequest.transactionDirection === TransactionDirectionConst.Spent ? frontendRequest.amount : 0
  }
  delete (backendRequest as any).transactionDirection
  delete (backendRequest as any).amount
  return backendRequest
}

export const convertToBackendUpdateRequest = (frontendRequest: TransactionUpdateRequest): any => {
  const backendRequest = {
    ...frontendRequest,
    // Convert datetime-local format to ISO string for backend
    transactionDate: new Date(frontendRequest.transactionDate).toISOString(),
    revenueAmount: frontendRequest.transactionDirection === TransactionDirectionConst.Revenue ? frontendRequest.amount : 0,
    spentAmount: frontendRequest.transactionDirection === TransactionDirectionConst.Spent ? frontendRequest.amount : 0
  }
  delete (backendRequest as any).transactionDirection
  delete (backendRequest as any).amount
  return backendRequest
}

/**
 * Builds the update request. While the original is linked to a debt, the locked fields go back exactly as the API sent them,
 * because the server refuses any difference from the stored values; otherwise it is the plain conversion of the form. (EN)
 *
 * Tạo yêu cầu cập nhật. Khi bản gốc đang gắn khoản nợ, các trường bị khóa được gửi lại nguyên như API đã trả, vì máy chủ từ
 * chối mọi khác biệt với giá trị đang lưu; nếu không thì là chuyển đổi form như thường lệ. (VI)
 */
export const buildTransactionUpdatePayload = (form: TransactionUpdateRequest, original: TransactionViewModel): any => {
  if (!original.debtLinkId) return convertToBackendUpdateRequest(form)
  const { transactionDate, accountId, revenueAmount, spentAmount, userId } = original
  // The conversion gets the stored date, so it cannot fail on what the locked control holds; its result is replaced anyway.
  return { ...convertToBackendUpdateRequest({ ...form, transactionDate }), transactionDate, accountId, revenueAmount, spentAmount, userId }
}

/**
 * Key of the reason why a transaction is locked, or null when it is not linked to a debt. A permanent lock comes first; an
 * unknown kind claims nothing but the link. (EN)
 *
 * Key của lý do giao dịch bị khóa, hoặc null khi không gắn khoản nợ. Khóa vĩnh viễn được xét trước; loại liên kết lạ chỉ nói
 * là có liên kết. (VI)
 */
export const getDebtLockKey = (transaction: TransactionViewModel | null): string | null => {
  if (!transaction?.debtLinkId) return null
  if (transaction.debtLinkPermanent) return 'transactions.debtLock.permanent'
  switch (transaction.debtLinkKind) {
    case 'Disbursement': return 'transactions.debtLock.disbursement'
    case 'Payment': return 'transactions.debtLock.payment'
    default: return 'transactions.debtLock.linked'
  }
} 
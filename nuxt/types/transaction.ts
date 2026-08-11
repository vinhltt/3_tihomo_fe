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
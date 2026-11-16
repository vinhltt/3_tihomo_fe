import { logger } from '~/utils/logger'
import { formatMoney } from '~/utils/display-format'
import type { 
  TransactionViewModel, 
  TransactionCreateRequest, 
  TransactionUpdateRequest,
  TransactionFilter,
  TransactionDirectionType,
  CategoryType
} from '~/types/transaction'
import type { FilterBodyRequest, ApiResponse, ApiError } from '~/types/api'
import type { IBasePaging } from '~/types/recurring-transaction'
import { FilterLogicalOperator, FilterType, SortDirection } from '~/types/api'
import { 
  TransactionDirectionConst,
  convertToBackendRequest, 
  convertToBackendUpdateRequest,
  getAmountClass,
  getTransactionDirection,
  getAmount,
  CategoryTypeConst
} from '~/types/transaction'

// The backend serializes CategoryType by name ("Expense"); values built on the client use the numeric constants.
const categoryTypeLabelKeys: Record<keyof typeof CategoryTypeConst, string> = {
  Income: 'enums.categoryType.income',
  Expense: 'enums.categoryType.expense',
  Transfer: 'enums.categoryType.transfer',
  Fee: 'enums.categoryType.fee',
  Other: 'enums.categoryType.other'
}

const findCategoryTypeName = (value: CategoryType | string | null | undefined): keyof typeof CategoryTypeConst | undefined => {
  const name = String(value ?? '').trim().toLowerCase()
  return (Object.keys(CategoryTypeConst) as (keyof typeof CategoryTypeConst)[]).find(
    (candidate) => candidate.toLowerCase() === name || CategoryTypeConst[candidate] === value
  )
}

/**
 * Gets the i18n key of a category type label from its enum name (any case) or numeric value; undefined when the
 * value is empty or unknown. (EN)
 *
 * Lấy key i18n của nhãn loại danh mục từ tên enum (không phân biệt hoa thường) hoặc giá trị số; undefined khi giá trị
 * rỗng hoặc không xác định. (VI)
 */
export const getCategoryTypeLabelKey = (value: CategoryType | string | null | undefined): string | undefined => {
  const match = findCategoryTypeName(value)
  return match ? categoryTypeLabelKeys[match] : undefined
}

/**
 * Gets the numeric category type from its enum name (any case) or numeric value; undefined when the value is empty
 * or unknown. (EN)
 *
 * Lấy giá trị số của loại danh mục từ tên enum (không phân biệt hoa thường) hoặc giá trị số; undefined khi giá trị
 * rỗng hoặc không xác định. (VI)
 */
export const getCategoryTypeValue = (value: CategoryType | string | null | undefined): CategoryType | undefined => {
  const match = findCategoryTypeName(value)
  return match ? CategoryTypeConst[match] : undefined
}

/**
 * Converts a caught error to the display error shape: a frontend message keeps its messageKey, a backend message is
 * kept verbatim, and an error with neither falls back to fallbackKey. (EN)
 *
 * Chuyển lỗi bắt được sang dạng lỗi hiển thị: thông báo FE giữ messageKey, thông báo backend giữ nguyên văn, lỗi không
 * có cả hai dùng fallbackKey. (VI)
 */
export const toTransactionErrorState = (
  err: unknown,
  fallbackKey: string
): Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> => {
  const apiError = err as Partial<ApiError> | null
  if (apiError?.messageKey) {
    return { messageKey: apiError.messageKey, messageParams: apiError.messageParams, message: apiError.message ?? '' }
  }
  return apiError?.message ? { message: apiError.message } : { messageKey: fallbackKey, message: '' }
}

export const useTransactions = () => {
  const { postForm, putForm, delete: deleteRequest, post } = useApi()
  
  // Reactive state
  const transactions = ref<TransactionViewModel[]>([])
  const selectedTransaction = ref<TransactionViewModel | null>(null)
  const isLoading = ref(false)
  // Always carries a fallback messageKey; message is kept for logging only.
  const error = ref<Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null>(null)
  const pagination = ref({
    pageIndex: 1,
    pageSize: 20,
    totalRow: 0,
    pageCount: 0
  })

  // Current filters
  const currentFilter = ref<TransactionFilter>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0] // today
  })

  // Get paginated transactions with filtering
  const getTransactions = async (filter?: Partial<TransactionFilter>, page: number = 1, pageSize: number = 20) => {
    try {
      isLoading.value = true
      error.value = null

      // Merge current filter with new filter
      const mergedFilter = { ...currentFilter.value, ...filter }
      
      // Handle clearing filters: if a filter value is empty string, remove it completely
      if (filter) {
        Object.keys(filter).forEach(key => {
          const value = filter[key as keyof TransactionFilter]
          if (value === '' || value === null || value === undefined) {
            delete mergedFilter[key as keyof TransactionFilter]
          }
        })
      }
      
      currentFilter.value = mergedFilter      // Build filter details array
      const filterDetails: any[] = []

      // Add account filter - only when a specific account is selected
      if (mergedFilter.accountId && mergedFilter.accountId.trim() !== '') {
        filterDetails.push({
          attributeName: 'accountId',
          filterType: FilterType.Equal,
          value: mergedFilter.accountId
        })
        logger.dev('Adding account filter:', mergedFilter.accountId)
      } else {
        logger.dev('No account filter - loading all accounts transactions')
      }

      if (mergedFilter.startDate && mergedFilter.startDate.trim() !== '') {
        filterDetails.push({
          attributeName: 'transactionDate',
          filterType: FilterType.GreaterThanOrEqual,
          value: mergedFilter.startDate
        })
      }

      if (mergedFilter.endDate && mergedFilter.endDate.trim() !== '') {
        filterDetails.push({
          attributeName: 'transactionDate',
          filterType: FilterType.LessThan,
          value: mergedFilter.endDate + 'T23:59:59' // Ensure we include the whole day
        })
      }

      if (mergedFilter.categoryType !== undefined && mergedFilter.categoryType !== null) {
        filterDetails.push({
          attributeName: 'categoryType',
          filterType: FilterType.Equal,
          value: mergedFilter.categoryType.toString()
        })
      }      // Build FilterBodyRequest
      const filterRequest: FilterBodyRequest = {
        langId: '',
        searchValue: '',
        filter: filterDetails.length > 0 ? {
          logicalOperator: FilterLogicalOperator.And,
          details: filterDetails
        } : {},
        orders: [
          {
            field: 'transactionDate',
            direction: SortDirection.Descending
          }
        ],
        pagination: {
          pageIndex: page,
          pageSize,
          totalRow: 0,
          pageCount: 0
        }
      }

      logger.dev('Transaction filter request:', {
        accountFilter: mergedFilter.accountId || 'ALL_ACCOUNTS',
        filterDetailsCount: filterDetails.length,
        filterRequest: JSON.stringify(filterRequest, null, 2)
      })

      const response = await post<ApiResponse<TransactionViewModel>>('/api/core-finance/transaction/filter', filterRequest)
      
      if (response?.data) {
        transactions.value = response.data
        pagination.value = response.pagination || pagination.value
      }

      return response
    } catch (err) {
      error.value = { messageKey: 'transactions.errors.loadFailed', message: err instanceof Error ? err.message : 'Failed to fetch transactions' }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Stateless paged search: never touches this composable's shared list state, so any owner can call it.
  const searchTransactions = (
    searchValue: string,
    pageIndex: number,
    pageSize: number,
    signal?: AbortSignal
  ): Promise<IBasePaging<TransactionViewModel>> => {
    const body: FilterBodyRequest = {
      langId: '',
      searchValue,
      filter: {},
      orders: [
        { field: 'transactionDate', direction: SortDirection.Descending },
        { field: 'id', direction: SortDirection.Descending }
      ],
      pagination: { pageIndex, pageSize, totalRow: 0, pageCount: 0 }
    }
    return post<IBasePaging<TransactionViewModel>>('/api/core-finance/transaction/filter', body, signal)
  }

  // Get transaction by ID
  const getTransactionById = async (id: string) => {
    try {
      isLoading.value = true
      error.value = null
        const response = await $fetch<TransactionViewModel>(`/api/core-finance/transaction/${id}`, {
        headers: {
          'Authorization': `Bearer ${useAuthStore().token}`
        }
      })
      
      selectedTransaction.value = response
      return response
    } catch (err) {
      error.value = { messageKey: 'transactions.errors.loadOneFailed', message: err instanceof Error ? err.message : 'Failed to fetch transaction' }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Create transaction
  const createTransaction = async (request: TransactionCreateRequest) => {
    try {
      isLoading.value = true
      error.value = null

      // Convert frontend request to backend format
      const backendRequest = convertToBackendRequest(request)
      
      const response = await postForm<TransactionViewModel>('/api/core-finance/transaction', backendRequest)
      
      if (response) {
        // Refresh the list
        await getTransactions()
      }
      
      return response
    } catch (err) {
      error.value = { messageKey: 'transactions.errors.createFailed', message: err instanceof Error ? err.message : 'Failed to create transaction' }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Update transaction
  const updateTransaction = async (request: TransactionUpdateRequest) => {
    try {
      isLoading.value = true
      error.value = null

      // Convert frontend request to backend format
      const backendRequest = convertToBackendUpdateRequest(request)
      
      const response = await putForm<TransactionViewModel>(`/api/core-finance/transaction/${request.id}`, backendRequest)
      
      if (response) {
        // Update local state
        const index = transactions.value.findIndex((t: TransactionViewModel) => t.id === request.id)
        if (index !== -1) {
          transactions.value[index] = response
        }
        if (selectedTransaction.value?.id === request.id) {
          selectedTransaction.value = response
        }
      }
      
      return response
    } catch (err) {
      error.value = { messageKey: 'transactions.errors.updateFailed', message: err instanceof Error ? err.message : 'Failed to update transaction' }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Delete transaction
  const deleteTransaction = async (id: string) => {
    try {
      isLoading.value = true
      error.value = null
      
      await deleteRequest(`/api/core-finance/transaction/${id}`)
      
      // Remove from local state
      transactions.value = transactions.value.filter((t: TransactionViewModel) => t.id !== id)
      if (selectedTransaction.value?.id === id) {
        selectedTransaction.value = null
      }
      
      return true
    } catch (err) {
      error.value = { messageKey: 'transactions.errors.deleteFailed', message: err instanceof Error ? err.message : 'Failed to delete transaction' }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Helper functions
  // Signed amount as a plain number, without a currency symbol.
  const getDisplayAmount = (transaction: TransactionViewModel) => {
    if (transaction.revenueAmount > 0) return `+${formatMoney(transaction.revenueAmount)}`
    if (transaction.spentAmount > 0) return `-${formatMoney(transaction.spentAmount)}`
    return formatMoney(0)
  }
  const getDisplayClass = (transaction: TransactionViewModel) => getAmountClass(transaction)
  const getDirection = (transaction: TransactionViewModel) => getTransactionDirection(transaction)
  const getAmountValue = (transaction: TransactionViewModel) => getAmount(transaction)

  // Filter helpers
  const filterByAccount = (accountId: string) => {
    getTransactions({ accountId })
  }

  const filterByDirection = (direction: TransactionDirectionType) => {
    getTransactions({ transactionDirection: direction })
  }

  const filterByDateRange = (startDate: string, endDate: string) => {
    getTransactions({ startDate, endDate })
  }

  const clearFilters = () => {
    currentFilter.value = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
    getTransactions()
  }

  // Form helpers
  const createFormDefaults = (direction?: TransactionDirectionType, accountId?: string): Partial<TransactionCreateRequest> => {
    return {
      transactionDate: new Date().toISOString().slice(0, 16), // Format for datetime-local input
      transactionDirection: direction || TransactionDirectionConst.Spent,
      accountId: accountId || '',
      categoryType: direction === TransactionDirectionConst.Revenue ? CategoryTypeConst.Income : CategoryTypeConst.Expense,
      syncMisa: false,
      syncSms: false,
      vn: true,
      amount: 0,
      balance: 0
    }
  }

  const resetForm = (form: any) => {
    if (form.amount !== undefined) form.amount = 0
    if (form.description !== undefined) form.description = ''
  }

  // State management helpers
  const setSelectedTransaction = (transaction: TransactionViewModel | null) => {
    selectedTransaction.value = transaction
  }

  return {
    // State
    transactions: readonly(transactions),
    selectedTransaction: readonly(selectedTransaction),
    isLoading: readonly(isLoading),
    error: readonly(error),
    pagination: readonly(pagination),
    currentFilter: readonly(currentFilter),
    
    // Actions
    getTransactions,
    searchTransactions,
    getTransactionById,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    
    // Helper functions
    getDisplayAmount,
    getDisplayClass,
    getDirection,
    getAmountValue,
    
    // Filter helpers
    filterByAccount,
    filterByDirection,
    filterByDateRange,
    clearFilters,
    
    // Form helpers
    createFormDefaults,
    resetForm,
    
    // State management
    setSelectedTransaction,
    
    // Constants
    TransactionDirectionConst,
    CategoryTypeConst
  }
} 
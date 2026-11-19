import type { 
  Account, 
  AccountType, 
  AccountCreateRequest, 
  AccountUpdateRequest, 
  AccountFilters,
  Pagination,
  FilterBodyRequest,
  ApiResponse 
} from '~/types'
import { formatDate as formatDisplayDate, formatMoney } from '~/utils/display-format'
import { useApi } from './useApi'

export const useAccounts = () => {
  const { get, post, postForm, put, putForm, delete: del } = useApi()
  /**
   * Fetch accounts with pagination and filters
   */
  const getAccounts = async (request: FilterBodyRequest): Promise<ApiResponse<Account>> => {
    return post<ApiResponse<Account>>('/api/core-finance/account/filter', request)
  }
  /**
   * Get account by ID
   */
  const getAccountById = async (id: string): Promise<Account> => {
    return get<Account>(`/api/core-finance/account/${id}`)
  }
  /**
   * Create new account
   */
  const createAccount = async (request: AccountCreateRequest): Promise<Account> => {
    return postForm<Account>('/api/core-finance/account', request)
  }
  /**
   * Update existing account
   */
  const updateAccount = async (id: string, request: AccountUpdateRequest): Promise<Account> => {
    return putForm<Account>(`/api/core-finance/account/${id}`, request)
  }
  /**
   * Delete account (soft delete)
   */
  const deleteAccount = async (id: string): Promise<void> => {
    return del<void>(`/api/core-finance/account/${id}`)
  }

  /**
   * Gets the i18n key of an account type label; undefined for an empty or unknown type. (EN)
   *
   * Lấy key i18n của nhãn loại tài khoản; undefined khi loại rỗng hoặc không xác định. (VI)
   */
  const getAccountTypeLabelKey = (type?: AccountType | null): string | undefined => {
    const keyMap: Record<AccountType, string> = {
      Bank: 'enums.accountType.bank',
      Wallet: 'enums.accountType.wallet',
      CreditCard: 'enums.accountType.creditCard',
      DebitCard: 'enums.accountType.debitCard',
      Cash: 'enums.accountType.cash'
    }
    return type ? keyMap[type] : undefined
  }

  /**
   * Get badge class for account type
   */
  const getAccountTypeBadgeClass = (type: AccountType): string => {
    const classMap: Record<AccountType, string> = {
      Bank: 'badge-outline-primary',
      Wallet: 'badge-outline-success',
      CreditCard: 'badge-outline-warning',
      DebitCard: 'badge-outline-info',
      Cash: 'badge-outline-secondary'
    }
    return classMap[type] || 'badge-outline-primary'
  }

  /**
   * Mask card number for security
   */
  const maskCardNumber = (cardNumber: string): string => {
    if (!cardNumber || cardNumber.length < 4) return cardNumber
    return '**** **** **** ' + cardNumber.slice(-4)
  }

  /**
   * Formats an amount as a plain number, without currency symbol or code. (EN)
   *
   * Định dạng số tiền thành số thuần, không kèm ký hiệu hay mã tiền tệ. (VI)
   */
  const formatCurrency = (amount: number | null | undefined): string => formatMoney(amount)

  /**
   * Get balance text color class
   */
  const getBalanceClass = (balance: number): string => {
    if (balance > 0) return 'text-green-600'
    if (balance < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  /**
   * Formats a date for display as yyyy/MM/dd. (EN)
   *
   * Định dạng ngày để hiển thị dạng yyyy/MM/dd. (VI)
   */
  const formatDate = (dateString?: string): string => formatDisplayDate(dateString)

  /**
   * Validates account form data; each error is an i18n key that the component translates. (EN)
   *
   * Kiểm tra dữ liệu form tài khoản; mỗi lỗi là một key i18n để component dịch. (VI)
   */
  const validateAccountForm = (data: Partial<AccountCreateRequest | AccountUpdateRequest>): Record<string, string> => {
    const errors: Record<string, string> = {}

    // Name validation
    if (!data.name?.trim()) {
      errors.name = 'accounts.validation.nameRequired'
    } else if (data.name.length < 2) {
      errors.name = 'accounts.validation.nameMinLength'
    }

    // Type validation  
    if (!data.type) {
      errors.type = 'accounts.validation.typeRequired'
    }

    // Currency validation
    if (!data.currency) {
      errors.currency = 'accounts.validation.currencyRequired'
    }

    // Card number validation for card types
    if (['CreditCard', 'DebitCard'].includes(data.type as string) && data.cardNumber) {
      const cardNumberClean = data.cardNumber.replace(/\s/g, '')
      if (cardNumberClean.length < 13 || cardNumberClean.length > 19) {
        errors.cardNumber = 'accounts.validation.cardNumberLength'
      }
    }

    // Initial balance validation (for create requests)
    if ('initialBalance' in data && typeof data.initialBalance === 'number' && data.initialBalance < 0) {
      errors.initialBalance = 'accounts.validation.initialBalanceNegative'
    }

    // Available limit validation
    if (data.availableLimit !== undefined && data.availableLimit < 0) {
      errors.availableLimit = 'accounts.validation.availableLimitNegative'
    }

    return errors
  }

  return {
    // API methods
    getAccounts,
    getAccountById,
    createAccount,
    updateAccount,
    deleteAccount,
    
    // Utility methods
    getAccountTypeLabelKey,
    getAccountTypeBadgeClass,
    maskCardNumber,
    formatCurrency,
    getBalanceClass,
    formatDate,
    validateAccountForm
  }
} 
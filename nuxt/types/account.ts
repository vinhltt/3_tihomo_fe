export type AccountType = 'Bank' | 'Wallet' | 'CreditCard' | 'DebitCard' | 'Cash'

export type Account = {
  id: string
  userId?: string
  name?: string
  type: AccountType
  cardNumber?: string
  currency?: string
  initialBalance: number
  currentBalance: number
  availableLimit?: number
  createAt?: string
  updateAt?: string
  createBy?: string
  updateBy?: string
}
export type AccountSelectOption = {
  id: string
  name: string
  currentBalance: number
  isActive: boolean
}

// Alias for consistency
export type AccountViewModel = Account

export type AccountCreateRequest = {
  userId?: string
  name: string
  type: AccountType
  cardNumber?: string
  currency: string
  initialBalance: number
  availableLimit?: number
}

export type AccountUpdateRequest = {
  id: string
  name?: string
  type?: AccountType
  cardNumber?: string
  currency?: string
  availableLimit?: number
}

export type AccountFilters = {
  search?: string
  type?: AccountType
  currency?: string
} 

<template>
  <div>    <!-- Page Header -->
    <div class="flex items-center justify-between mb-5">
      <h5 class="font-semibold text-lg dark:text-white-light">{{ pageTitle }}</h5>
      
      <!-- Breadcrumb Navigation -->
      <NavigationBreadcrumb 
        :items="breadcrumbs"
        @item-click="handleBreadcrumbClick"
      />
    </div>

    <!-- Filters Section -->
    <div class="panel mb-5">
      <div class="flex flex-col sm:flex-row gap-4 mb-5">        <!-- Account Filter -->
        <div class="sm:w-1/3">
          <AccountDropdown
            v-model="selectedAccountId"
            :accounts="accountOptions"
            label="Tài khoản"
            all-accounts-text="Tất cả tài khoản"
            :show-balance="true"
            @change="onAccountFilterChange"
          />
        </div>

        <!-- Date Range Filter -->
        <div class="sm:w-1/3">
          <label class="block text-sm font-medium mb-2">Từ ngày</label>
          <input 
            v-model="dateFrom" 
            type="date" 
            class="form-input"
            @change="onDateRangeChange"
          />
        </div>
        <div class="sm:w-1/3">
          <label class="block text-sm font-medium mb-2">Đến ngày</label>
          <input 
            v-model="dateTo" 
            type="date" 
            class="form-input"
            @change="onDateRangeChange"
          />
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-2 mb-4">        
        <button 
          @click="() => openAddTransactionForm(CategoryTypeConst.Income)"
          class="btn btn-success"
        >
          <span class="mr-2">+</span>
          Giao dịch Thu
        </button>
        <button 
          @click="() => openAddTransactionForm(CategoryTypeConst.Expense)"
          class="btn btn-danger"
        >
          <span class="mr-2">-</span>
          Giao dịch Chi
        </button>
      </div>
    </div>

    <!-- Main Content Layout -->
    <div class="grid grid-cols-1 gap-5" :class="{ 'lg:grid-cols-2': isDetailPaneOpen }">      <!-- Transaction List -->
      <div class="panel" :class="{ 'lg:col-span-1': isDetailPaneOpen }">
        <TransactionList
          :transactions="transactions"
          :loading="isLoading"
          :title="'Danh sách giao dịch'"
          @transaction-select="selectTransaction"
          @transaction-edit="editTransaction"
          @refresh="refreshTransactions"        />
      </div>

      <!-- Transaction Detail Pane -->
      <div v-if="isDetailPaneOpen" class="panel lg:col-span-1">
        <div class="flex items-center justify-between mb-5">
          <h6 class="text-lg font-semibold">
            {{ isAddMode ? 'Thêm giao dịch' : 'Chi tiết giao dịch' }}
          </h6>          <button 
            @click="closeDetailPane"
            class="btn btn-sm btn-outline-danger"
          >
            <span class="w-4 h-4">✕</span>
          </button>
        </div>

        <!-- Transaction Modal -->
        <div v-if="isAddMode || selectedTransaction">
          <p class="text-sm text-gray-500 mb-2">Debug: {{ accountOptions.length }} accounts loaded</p>
          <TransactionModal
            :visible="true"
            :transaction="selectedTransaction"
            :accounts="accountOptions"
            :mode="isAddMode ? 'create' : (isEditMode ? 'edit' : 'view')"
            :default-direction="defaultTransactionDirection"
            @update:visible="closeDetailPane"
            @created="onTransactionCreated"
            @updated="onTransactionUpdated"
            @deleted="onTransactionDeleted"
            @edit="editTransaction"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { logger } from '~/utils/logger'

import { useTransactionFilterStore } from '@/stores/transactionFilter'
import TransactionModal from '@/components/apps/transactions/TransactionModal.vue'
import type { AccountSelectOption } from '~/types/account'
import { CategoryTypeConst, TransactionDirectionConst, type CategoryType, type TransactionDirectionType, type TransactionViewModel } from '~/types/transaction'

// Date utilities (thay vì date-fns để tránh dependencies)
function subDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

function formatDate(date: Date, format: 'yyyy-MM-dd' | 'dd/MM/yyyy' | 'dd/MM HH:mm'): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  
  switch (format) {
    case 'yyyy-MM-dd':
      return `${year}-${month}-${day}`
    case 'dd/MM/yyyy':
      return `${day}/${month}/${year}`
    case 'dd/MM HH:mm':
      return `${day}/${month} ${hours}:${minutes}`
    default:
      return date.toISOString()
  }
}

// Types - Transaction Navigation Filtering Feature
type RouteQuery = {
  accountId?: string
  accountName?: string
}

type TransactionDirectionConst = 'Revenue' | 'Spent'

type Transaction = {
  id: string
  transactionDate: string
  description: string
  revenueAmount: number
  spentAmount: number
  balance: number | null
  accountId: string
  accountName: string
}

// Composables và stores
const route = useRoute()
const router = useRouter()
const transactionFilterStore = useTransactionFilterStore()

// Reactive data
const isLoading = ref(false)
const isDetailPaneOpen = ref(false)
const isAddMode = ref(false)
const isEditMode = ref(false)
const selectedTransactionId = ref<string | null>(null)
const selectedTransaction = ref<TransactionViewModel | null>(null)
const defaultTransactionDirection = ref<TransactionDirectionType>(TransactionDirectionConst.Spent)

// Filter states - bound to store
const selectedAccountId = computed({
  get: () => transactionFilterStore.selectedAccountId,
  set: (value) => transactionFilterStore.setAccountFilter(value, getAccountNameById(value))
})

const dateFrom = computed({
  get: () => formatDate(transactionFilterStore.dateFrom, 'yyyy-MM-dd'),
  set: (value) => transactionFilterStore.setDateRange(new Date(value), transactionFilterStore.dateTo)
})

const dateTo = computed({
  get: () => formatDate(transactionFilterStore.dateTo, 'yyyy-MM-dd'),
  set: (value) => transactionFilterStore.setDateRange(transactionFilterStore.dateFrom, new Date(value))
})

// API data
const transactions = ref<TransactionViewModel[]>([])
const accountOptions = ref<AccountSelectOption[]>([])

// Computed properties
const pageTitle = computed(() => {
  const accountName = transactionFilterStore.selectedAccountName
  return accountName && accountName !== 'Tất cả tài khoản' 
    ? `Giao dịch - ${accountName}` 
    : 'Giao dịch'
})

const breadcrumbs = computed(() => {
  const { accountId, accountName } = route.query as RouteQuery
  
  if (accountId && accountName) {
    // Navigation from Account page
    return [
      { name: 'Dashboard', path: '/' },
      { name: 'Accounts', path: '/accounts' },
      { name: accountName, path: `/accounts?highlight=${accountId}` },
      { name: 'Transactions', path: '' }
    ]
  } else {
    // Direct navigation from menu
    return [
      { name: 'Dashboard', path: '/' },
      { name: 'Transactions', path: '' }
    ]
  }
})

// Methods
function getAccountNameById(accountId: string | null): string {
  if (!accountId) return 'Tất cả tài khoản'
  const account = accountOptions.value.find(a => a.id === accountId)
  return account?.name || 'Tất cả tài khoản'
}

async function handleNavigationContext() {
  const { accountId, accountName } = route.query as RouteQuery
  
  if (accountId && accountName) {
    // Case 1: Navigation from Account page
    await handleAccountNavigation(accountId, accountName)
  } else {
    // Case 2: Direct navigation from menu
    await handleDirectNavigation()
  }
}

async function handleAccountNavigation(accountId: string, accountName: string) {
  // Set filter state
  transactionFilterStore.setAccountFilter(accountId, accountName)
  
  // Set page title via head
  useHead({
    title: `Giao dịch - ${accountName}`
  })
  
  // Load transactions for specific account (30 days)
  await loadTransactions({
    accountId: accountId,
    dateFrom: subDays(new Date(), 30),
    dateTo: new Date()
  })
}

async function handleDirectNavigation() {
  // Set default filter state
  transactionFilterStore.setAccountFilter(null, 'Tất cả tài khoản')
  
  // Set page title
  useHead({
    title: 'Giao dịch'
  })
  
  // Load all transactions (30 days)
  await loadTransactions({
    accountId: null,
    dateFrom: subDays(new Date(), 30),
    dateTo: new Date()
  })
}

async function loadAccounts() {
  try {
    // Call API to get accounts with proper format
    const response = await $fetch<any>('/api/core-finance/account', {
      query: {
        pageIndex: 1,
        pageSize: 100  // Get all accounts
      }
    })
    
    logger.dev('API Response:', response) // Debug log
    
    // Map API response to our Account type
    if (response && response.data && Array.isArray(response.data)) {
      accountOptions.value = response.data.map((account: any) => ({
        id: account.id,
        name: account.name,
        currentBalance: account.currentBalance || 0,
        isActive: true
      }))
      logger.dev('Mapped accounts:', accountOptions.value) // Debug log
    } else {
      logger.error('Unexpected response format:', response)
    }
  } catch (error) {
    logger.error('Failed to load accounts:', error)
    // Show error notification if needed
  }
}

async function loadTransactions(filters: {
  accountId: string | null
  dateFrom: Date
  dateTo: Date
}) {
  isLoading.value = true
  
  try {
    // TODO: Replace with actual API call
    // const response = await $fetch('/api/core-finance/transaction', { query: filters })
    
    // Mock data for now
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate loading
    
    transactions.value = [
      {
        id: '1',
        transactionDate: new Date().toISOString(),
        description: 'Mua sắm tại Vinmart',
        revenueAmount: 0,
        spentAmount: 250000,
        balance: 4750000,
        accountId: '1',
        syncMisa: false,
        syncSms: false,
        vn: false,
        categoryType: CategoryTypeConst.Expense,
      },
      // Add more mock data as needed
    ]
  } catch (error) {
    logger.error('Error loading transactions:', error)
    // TODO: Show error toast
  } finally {
    isLoading.value = false
  }
}

function onAccountFilterChange() {
  // Update URL to reflect current selection
  const accountId = selectedAccountId.value
  if (accountId) {
    const accountName = getAccountNameById(accountId)
    router.replace({
      query: {
        ...route.query,
        accountId: accountId,
        accountName: accountName
      }
    })
  } else {
    // Remove account params from URL
    const { accountId: _, accountName: __, ...restQuery } = route.query
    router.replace({ query: restQuery })
  }
  
  // Reload transactions with new filter
  loadTransactions({
    accountId: selectedAccountId.value,
    dateFrom: transactionFilterStore.dateFrom,
    dateTo: transactionFilterStore.dateTo
  })
}

function onDateRangeChange() {
  // Reload transactions with new date range
  loadTransactions({
    accountId: selectedAccountId.value,
    dateFrom: transactionFilterStore.dateFrom,
    dateTo: transactionFilterStore.dateTo
  })
}

async function openAddTransactionForm(categoryType: CategoryType) {
  // Ensure accounts are loaded first
  if (accountOptions.value.length === 0) {
    logger.dev('Loading accounts before opening form...')
    await loadAccounts()
  }
  
  isAddMode.value = true
  isEditMode.value = false
  isDetailPaneOpen.value = true
  selectedTransaction.value = null
  selectedTransactionId.value = null
  
  logger.dev('Opening form with accounts:', accountOptions.value)
}

function selectTransaction(transaction: TransactionViewModel) {
  isAddMode.value = false
  isEditMode.value = false
  isDetailPaneOpen.value = true
  selectedTransaction.value = transaction
  selectedTransactionId.value = transaction.id
}

function editTransaction(transaction?: TransactionViewModel) {
  if (transaction) {
    selectedTransaction.value = transaction
    selectedTransactionId.value = transaction.id
  }
  isEditMode.value = true
  isAddMode.value = false
  isDetailPaneOpen.value = true
}

function closeDetailPane() {
  isDetailPaneOpen.value = false
  isAddMode.value = false
  isEditMode.value = false
  selectedTransaction.value = null
  selectedTransactionId.value = null
}

async function onTransactionCreated() {
  closeDetailPane()
  await refreshTransactions()
  // Show success notification
  logger.dev('Transaction created successfully')
}

async function onTransactionUpdated() {
  closeDetailPane()
  await refreshTransactions()
  // Show success notification
  logger.dev('Transaction updated successfully')
}

async function onTransactionDeleted() {
  closeDetailPane()
  await refreshTransactions()
  // Show success notification
  logger.dev('Transaction deleted successfully')
}

async function refreshTransactions() {
  await loadTransactions({
    accountId: selectedAccountId.value,
    dateFrom: transactionFilterStore.dateFrom,
    dateTo: transactionFilterStore.dateTo
  })
}

function formatDateTime(dateString: string): string {
  return formatDate(new Date(dateString), 'dd/MM HH:mm')
}

function formatAmount(transaction: Transaction): string {
  if (transaction.revenueAmount > 0) {
    return `+${formatCurrency(transaction.revenueAmount)}`
  } else {
    return `-${formatCurrency(transaction.spentAmount)}`
  }
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return '-'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount)
}

function getAmountColorClass(transaction: Transaction): string {
  return transaction.revenueAmount > 0 ? 'text-success' : 'text-danger'
}

function handleBreadcrumbClick(item: any, index: number) {
  logger.dev('Breadcrumb clicked:', item, index)
  // Navigation handling is already done by NavigationBreadcrumb component
}



// Lifecycle
onMounted(async () => {
  // Load accounts first
  await loadAccounts()
  // Then handle navigation context
  await handleNavigationContext()
})

// Handle browser back/forward navigation
watch(() => route.query, async () => {
  await handleNavigationContext()
})

// SEO và Meta
useHead({
  title: pageTitle.value
})
</script>

<style scoped>
/* Component-specific styles if needed */
.table-responsive {
  overflow-x: auto;
}

.table-hover tbody tr:hover {
  background-color: rgb(249 250 251);
}

.dark .table-hover tbody tr:hover {
  background-color: rgb(31 41 55);
}
</style>

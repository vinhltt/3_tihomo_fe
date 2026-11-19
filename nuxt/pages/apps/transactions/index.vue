<template>
  <div class="space-y-6"> <!-- Header với breadcrumbs -->
    <div>
      <ul class="flex space-x-2 rtl:space-x-reverse">
        <li>
          <NuxtLink to="/apps" class="text-primary hover:underline">{{ t('apps') }}</NuxtLink>
        </li>
        <li v-if="route.query.accountId && route.query.accountName"
          class="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
          <NuxtLink to="/apps/accounts" class="text-primary hover:underline">{{ t('shell.nav.accounts') }}</NuxtLink>
        </li>
        <li v-if="route.query.accountId && route.query.accountName"
          class="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
          <NuxtLink :to="`/apps/accounts?highlight=${route.query.accountId}`" class="text-primary hover:underline">
            {{ route.query.accountName }}
          </NuxtLink>
        </li>
        <li class="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
          <span>{{ t('shell.nav.transactions') }}</span>
        </li>
      </ul>
      <div class="pt-5">
        <h1 class="text-2xl font-semibold">
          {{ route.query.accountName ? t('transactions.list.titleForAccount', { name: String(route.query.accountName) }) : t('transactions.list.title') }}
        </h1>
        <p class="text-gray-600 dark:text-white-light">
          {{
            route.query.accountName
              ? t('transactions.list.descriptionForAccount', { name: String(route.query.accountName) })
              : t('transactions.list.description')
          }}
        </p>
      </div>
    </div>

    <!-- Filter Section -->
    <div class="panel">
      <div class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6"> <!-- Account Filter -->
        <div class="flex-1">
          <label class="text-sm font-medium">{{ t('transactions.fields.account') }}</label>
          <div class="relative">
            <select v-model="selectedAccountId" @change="handleAccountChange" class="form-select" :disabled="isLoading">
              <option value="">{{ t('accounts.dropdown.allAccounts') }}</option>
              <option v-for="account in accounts" :key="account.id" :value="account.id">
                {{ account.name }}
              </option>
            </select>
            <div v-if="isLoading" class="absolute right-8 top-1/2 transform -translate-y-1/2">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            </div>
          </div>
        </div>

        <!-- Date Range -->
        <div class="flex-1">
          <label class="text-sm font-medium">{{ t('transactions.filters.fromDate') }}</label>
          <input v-model="dateRange.startDate" @change="handleDateRangeChange" type="date" class="form-input" />
        </div>
        <div class="flex-1">
          <label class="text-sm font-medium">{{ t('transactions.filters.toDate') }}</label>
          <input v-model="dateRange.endDate" @change="handleDateRangeChange" type="date" class="form-input" />
        </div>

        <!-- Quick Actions -->
        <div class="flex gap-2">
          <button @click="() => openCreateModal(TransactionDirectionConst.Revenue)" class="btn btn-outline-success">
            <icon-plus class="w-4 h-4" />
            {{ t('enums.transactionDirection.revenue') }}
          </button>
          <button @click="() => openCreateModal(TransactionDirectionConst.Spent)" class="btn btn-outline-danger">
            <icon-plus class="w-4 h-4" />
            {{ t('enums.transactionDirection.spent') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Main Layout: Transaction List + Detail Panel -->
    <div class="relative">
      <!-- Transaction List Container -->
      <div class="transition-all duration-300" :class="showDetailPanel ? 'lg:mr-[50%]' : ''">
        <div class="panel">
          <!-- Table Header với Column Selector -->
          <div class="mb-5 flex items-center justify-between">
            <h5 class="text-lg font-semibold dark:text-white-light">
              {{ t('transactions.list.heading') }}
            </h5>
            <div class="flex items-center gap-4">
              <div class="text-sm text-gray-500">
                {{ t('transactions.list.total', { count: pagination.totalRow }) }}
              </div>

              <!-- Columns Selector -->
              <div class="relative">
                <Popper placement="bottom-end">
                  <button class="btn btn-outline-primary btn-sm">
                    <icon-settings class="w-4 h-4" />
                    {{ t('transactions.columns.button') }}
                  </button>
                  <template #content="{ close }">
                    <div
                      class="bg-white dark:bg-[#0e1726] border border-gray-200 dark:border-[#1b2e4b] rounded-lg shadow-lg p-4 min-w-[200px]">
                      <h6 class="font-semibold mb-3">{{ t('transactions.columns.title') }}</h6>
                      <div class="space-y-2">
                        <label class="flex items-center">
                          <input type="checkbox" v-model="visibleColumns.date" class="form-checkbox" />
                          <span class="ml-2">{{ t('transactions.fields.date') }}</span>
                        </label>
                        <label class="flex items-center">
                          <input type="checkbox" v-model="visibleColumns.description" class="form-checkbox" />
                          <span class="ml-2">{{ t('transactions.fields.description') }}</span>
                        </label>
                        <label class="flex items-center">
                          <input type="checkbox" v-model="visibleColumns.amount" class="form-checkbox" />
                          <span class="ml-2">{{ t('transactions.fields.amount') }}</span>
                        </label>
                        <hr class="border-gray-200 dark:border-[#1b2e4b]" />
                        <label class="flex items-center">
                          <input type="checkbox" v-model="visibleColumns.account" class="form-checkbox" />
                          <span class="ml-2">{{ t('transactions.fields.account') }}</span>
                        </label>
                        <label class="flex items-center">
                          <input type="checkbox" v-model="visibleColumns.category" class="form-checkbox" />
                          <span class="ml-2">{{ t('transactions.fields.category') }}</span>
                        </label>
                        <label class="flex items-center">
                          <input type="checkbox" v-model="visibleColumns.balance" class="form-checkbox" />
                          <span class="ml-2">{{ t('transactions.fields.balance') }}</span>
                        </label>
                        <label class="flex items-center">
                          <input type="checkbox" v-model="visibleColumns.actions" class="form-checkbox" />
                          <span class="ml-2">{{ t('common.actions') }}</span>
                        </label>
                      </div>
                      <div class="flex gap-2 mt-4">
                        <button @click="setSimpleMode()" class="btn btn-outline-primary btn-sm flex-1">
                          {{ t('transactions.columns.simple') }}
                        </button>
                        <button @click="setAdvancedMode()" class="btn btn-outline-primary btn-sm flex-1">
                          {{ t('transactions.columns.advanced') }}
                        </button>
                      </div>
                    </div>
                  </template>
                </Popper>
              </div>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="isLoading" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p class="mt-2 text-gray-500">{{ t('common.loading') }}</p>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="text-center py-8 text-danger">
            <p>{{ errorText }}</p>
            <button @click="getTransactions()" class="btn btn-primary mt-2">
              {{ t('common.retry') }}
            </button>
          </div>

          <!-- Empty State -->
          <div v-else-if="!transactions.length" class="text-center py-8">
            <icon-folder class="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p class="text-gray-500">{{ t('transactions.empty.title') }}</p>
            <div class="flex flex-wrap gap-2 justify-center mt-4">
              <button @click="() => openCreateModal(TransactionDirectionConst.Revenue)" class="btn btn-success btn-sm whitespace-nowrap">
                {{ t('transactions.actions.addIncome') }}
              </button>
              <button @click="() => openCreateModal(TransactionDirectionConst.Spent)" class="btn btn-danger btn-sm whitespace-nowrap">
                {{ t('transactions.actions.addExpense') }}
              </button>
            </div>
          </div>

          <!-- Transaction Table -->
          <div v-else class="table-responsive">
            <table class="table-hover">
              <thead>
                <tr>
                  <th v-if="visibleColumns.date">{{ t('transactions.fields.date') }}</th>
                  <th v-if="visibleColumns.account">{{ t('transactions.fields.account') }}</th>
                  <th v-if="visibleColumns.description">{{ t('transactions.fields.description') }}</th>
                  <th v-if="visibleColumns.category">{{ t('transactions.fields.category') }}</th>
                  <th v-if="visibleColumns.amount" class="text-right">{{ t('transactions.fields.amount') }}</th>
                  <th v-if="visibleColumns.balance" class="text-right">{{ t('transactions.fields.balance') }}</th>
                  <th v-if="visibleColumns.actions" class="text-center">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="transaction in transactions" :key="transaction.id"
                  @click="() => selectTransaction(transaction)" class="cursor-pointer transition-colors" :class="[
                    'hover:bg-gray-50 dark:hover:bg-gray-800',
                    selectedTransaction?.id === transaction.id ? 'bg-primary/10 border-l-4 border-primary' : ''
                  ]">
                  <td v-if="visibleColumns.date">
                    <div class="text-sm font-medium">
                      {{ formatDateTime(transaction.transactionDate) }}
                    </div>
                  </td>
                  <td v-if="visibleColumns.account">
                    <div class="font-medium">
                      {{ getAccountById(transaction.accountId)?.name || t('common.unknown') }}
                    </div>
                  </td>
                  <td v-if="visibleColumns.description">
                    <div class="max-w-xs truncate" :title="transaction.description">
                      {{ transaction.description || '-' }}
                    </div>
                  </td>
                  <td v-if="visibleColumns.category">
                    <span class="badge badge-outline-info">
                      {{ categoryTypeLabel(transaction.categoryType) }}
                    </span>
                  </td>
                  <td v-if="visibleColumns.amount" class="text-right">
                    <span :class="getDisplayClass(transaction)" class="font-semibold">
                      {{ getDisplayAmount(transaction) }}
                    </span>
                  </td>
                  <td v-if="visibleColumns.balance" class="text-right">
                    <span class="font-medium">
                      {{ formatMoney(transaction.balance) }}
                    </span>
                  </td>
                  <td v-if="visibleColumns.actions" class="text-center">
                    <div class="flex items-center justify-center gap-2">
                      <button @click.stop="() => selectTransaction(transaction)" class="btn btn-sm btn-outline-primary"
                        :title="t('common.showDetails')">
                        <icon-eye class="w-4 h-4" />
                      </button>
                      <button @click.stop="() => editTransaction(transaction)" class="btn btn-sm btn-outline-warning"
                        :title="t('common.edit')">
                        <icon-edit class="w-4 h-4" />
                      </button>
                      <button @click.stop="() => confirmDelete(transaction)" class="btn btn-sm btn-outline-danger"
                        :title="t('common.delete')">
                        <icon-trash class="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div v-if="pagination.pageCount > 1" class="mt-5 flex items-center justify-between">
            <div class="text-sm text-gray-500">
              {{
                t('transactions.pagination.summary', {
                  from: (pagination.pageIndex - 1) * pagination.pageSize + 1,
                  to: Math.min(pagination.pageIndex * pagination.pageSize, pagination.totalRow),
                  total: pagination.totalRow
                })
              }}
            </div>
            <div class="flex gap-1">
              <button @click="changePage(pagination.pageIndex - 1)" :disabled="pagination.pageIndex <= 1"
                class="btn btn-sm btn-outline-primary">
                {{ t('common.previous') }}
              </button>
              <button @click="changePage(pagination.pageIndex + 1)"
                :disabled="pagination.pageIndex >= pagination.pageCount" class="btn btn-sm btn-outline-primary">
                {{ t('common.next') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Transaction Detail Panel (Desktop) -->
      <div v-if="showDetailPanel"
        class="fixed right-0 top-0 h-full w-full lg:w-1/2 z-40 bg-white dark:bg-[#0e1726] border-l border-gray-200 dark:border-[#1b2e4b] transition-transform duration-300"
        :class="showDetailPanel ? 'translate-x-0' : 'translate-x-full'">
        <div class="h-full overflow-y-auto">
          <TransactionDetailPanel :visible="showDetailPanel" :transaction="selectedTransaction"
            :accounts="[...accounts]" :mode="detailMode" :default-direction="defaultDirection"
            :default-account-id="selectedAccountId" @update:visible="closeDetailPanel"
            @created="handleTransactionCreated" @updated="handleTransactionUpdated" @deleted="handleTransactionDeleted"
            @edit="handleEdit" />
        </div>
      </div>

      <!-- Mobile Overlay -->
      <div v-if="showDetailPanel" class="lg:hidden fixed inset-0 bg-black/50 z-30" @click="closeDetailPanel"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { logger } from '~/utils/logger'
import { formatDateTime, formatMoney } from '~/utils/display-format'
import Swal from 'sweetalert2'

import type { TransactionViewModel, TransactionFilter, TransactionDirectionType, CategoryType } from '~/types/transaction'
import type { AccountViewModel } from '~/types/account'
import { TransactionDirectionConst, getAmountClass } from '~/types/transaction'
import { getCategoryTypeLabelKey } from '~/composables/useTransactions'
import TransactionDetailPanel from '~/components/apps/transactions/TransactionDetailPanel.vue'

// Composables
const { t } = useI18n()
const route = useRoute()
const {
  transactions,
  selectedTransaction,
  isLoading,
  error,
  pagination,
  getTransactions,
  deleteTransaction,
  filterByAccount,
  filterByDateRange,
  setSelectedTransaction,
  getDisplayAmount
} = useTransactions()

const { accounts, getAccounts, getAccountById } = useAccountsSimple()

// A frontend message carries messageKey; a backend message is shown verbatim.
const errorText = computed(() => {
  const apiError = error.value
  return apiError?.messageKey
    ? t(apiError.messageKey, apiError.messageParams ?? {})
    : apiError?.message || t('transactions.errors.loadFailed')
})

// Page State
const selectedAccountId = ref('')
const dateRange = ref({
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0]
})

const showDetailPanel = ref(false)
const detailMode = ref<'create' | 'edit' | 'view'>('view')
const defaultDirection = ref<TransactionDirectionType>(TransactionDirectionConst.Spent)

// Column visibility state
const visibleColumns = ref({
  date: true,
  description: true,
  amount: true,
  account: false,
  category: false,
  balance: false,
  actions: false
})

// SEO
useHead({
  title: computed(() => {
    const { accountId, accountName } = route.query
    return accountId && accountName
      ? `${t('transactions.list.titleForAccount', { name: String(accountName) })} | ${t('transactions.list.title')}`
      : t('transactions.list.title')
  })
})

// Keyboard event handler
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && showDetailPanel.value) {
    closeDetailPanel()
  }
}

// Lifecycle
onMounted(async () => {
  await Promise.all([
    getAccounts(),
    handleNavigationContext()
  ])

  // Add ESC key listener
  window.addEventListener('keydown', handleKeydown)
})

// Handle navigation context from query parameters
const handleNavigationContext = async () => {
  const { accountId, accountName } = route.query

  if (accountId && accountName) {
    // Set the selected account based on navigation context
    selectedAccountId.value = accountId as string

    // Filter transactions by the selected account
    await getTransactions({ accountId: accountId as string })
  } else {
    // Default behavior - load all transactions
    await getTransactions()
  }
}

onUnmounted(() => {
  // Remove ESC key listener
  window.removeEventListener('keydown', handleKeydown)
})

// Methods
const handleAccountChange = () => {
  // If "Tất cả tài khoản" is selected (empty string), pass undefined to clear the filter
  // Otherwise pass the selected account ID
  const accountIdFilter = selectedAccountId.value === '' ? undefined : selectedAccountId.value

  logger.dev('Account filter changed:', {
    selectedValue: selectedAccountId.value,
    filterValue: accountIdFilter,
    willFilterByAccount: accountIdFilter !== undefined
  })

  // Always call getTransactions with accountId filter to ensure proper clearing
  getTransactions({ accountId: accountIdFilter })
}

const handleDateRangeChange = () => {
  filterByDateRange(dateRange.value.startDate, dateRange.value.endDate)
}

const openCreateModal = (direction: TransactionDirectionType) => {
  detailMode.value = 'create'
  setSelectedTransaction(null)
  defaultDirection.value = direction
  showDetailPanel.value = true
}

const selectTransaction = (transaction: TransactionViewModel) => {
  setSelectedTransaction(transaction)
  detailMode.value = 'view'
  showDetailPanel.value = true
}

const editTransaction = (transaction: TransactionViewModel) => {
  setSelectedTransaction(transaction)
  detailMode.value = 'edit'
  showDetailPanel.value = true
}

const closeDetailPanel = () => {
  showDetailPanel.value = false
  setSelectedTransaction(null)
}

const confirmDelete = async (transaction: TransactionViewModel) => {
  const result = await Swal.fire({
    title: t('common.confirmation.title'),
    text: t('transactions.confirm.delete', { description: transaction.description || t('transactions.confirm.noDescription') }),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: t('common.confirmation.yesDelete'),
    cancelButtonText: t('common.cancel')
  })

  if (result.isConfirmed) {
    try {
      await deleteTransaction(transaction.id)
      await getTransactions()
    } catch (err) {
      logger.error('Failed to delete transaction:', err)
    }
  }
}

const changePage = async (page: number) => {
  if (page >= 1 && page <= pagination.value.pageCount) {
    await getTransactions({}, page)
  }
}

// Column visibility methods
const setSimpleMode = () => {
  visibleColumns.value = {
    date: true,
    description: true,
    amount: true,
    account: false,
    category: false,
    balance: false,
    actions: false
  }
}

const setAdvancedMode = () => {
  visibleColumns.value = {
    date: true,
    description: true,
    amount: true,
    account: true,
    category: true,
    balance: true,
    actions: true
  }
}

// Event handlers
const handleTransactionCreated = () => {
  closeDetailPanel()
  getTransactions()
}

const handleTransactionUpdated = () => {
  closeDetailPanel()
  getTransactions()
}

const handleTransactionDeleted = () => {
  closeDetailPanel()
  getTransactions()
}

const handleEdit = () => {
  detailMode.value = 'edit'
}

// Helper functions
// An empty or unmapped category type is shown as the backend sent it.
const categoryTypeLabel = (categoryType: CategoryType | string | null | undefined): string => {
  const key = getCategoryTypeLabelKey(categoryType)
  return key ? t(key) : String(categoryType ?? '')
}

const getDisplayClass = (transaction: TransactionViewModel) => {
  return getAmountClass(transaction)
}
</script>
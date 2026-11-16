<template>
  <div>
    <!-- Breadcrumb -->
    <ul class="flex space-x-2 rtl:space-x-reverse">
      <li>
        <NuxtLink to="/" class="text-primary hover:underline">{{ t('shell.breadcrumb.dashboard') }}</NuxtLink>
      </li>
      <li class="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
        <NuxtLink to="/apps/accounts" class="text-primary hover:underline">{{ t('shell.nav.accounts') }}</NuxtLink>
      </li>
      <li class="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
        <span>{{ account?.name || t('accounts.detail.title') }}</span>
      </li>
    </ul>

    <div class="pt-5">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex justify-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>

      <!-- Account Not Found -->
      <div v-else-if="!account" class="panel">
        <div class="text-center py-20">
          <h3 class="text-2xl font-semibold text-gray-500 mb-4">{{ t('accounts.detail.notFound') }}</h3>
          <p class="text-gray-400 mb-6">{{ t('accounts.detail.notFoundDescription') }}</p>
          <NuxtLink to="/apps/accounts" class="btn btn-primary">
            {{ t('accounts.actions.backToList') }}
          </NuxtLink>
        </div>
      </div>

      <!-- Account Details -->
      <div v-else>
        <!-- Header with Account Info -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ account.name }}</h2>
              <div class="flex items-center gap-3 mt-2">
                <span class="badge" :class="getAccountTypeBadgeClass(account.type)">
                  {{ accountTypeLabel(account.type) }}
                </span>
                <span class="text-sm text-gray-500">
                  {{ t('accounts.detail.createdOn', { date: formatDateTime(account.createAt) }) }}
                </span>
              </div>
            </div>
            <div class="flex gap-3">
              <button type="button" class="btn btn-outline-primary" @click="openEditModal">
                <icon-edit class="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {{ t('accounts.actions.edit') }}
              </button>
              <button type="button" class="btn btn-outline-danger" @click="confirmDelete">
                <icon-trash class="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {{ t('common.delete') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Balance Overview Cards -->
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <!-- Current Balance -->
          <div class="panel">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm text-gray-500 mb-1">{{ t('accounts.fields.currentBalance') }}</div>
                <div class="text-2xl font-bold" :class="getBalanceClass(account.currentBalance)">
                  {{ formatCurrency(account.currentBalance) }}
                </div>
              </div>
              <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <icon-credit-card class="h-6 w-6 text-primary" />
              </div>
            </div>
          </div>

          <!-- Initial Balance -->
          <div class="panel">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm text-gray-500 mb-1">{{ t('accounts.fields.initialBalance') }}</div>
                <div class="text-2xl font-bold text-gray-700 dark:text-gray-300">
                  {{ formatCurrency(account.initialBalance) }}
                </div>
              </div>
              <div class="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
                <icon-plus class="h-6 w-6 text-success" />
              </div>
            </div>
          </div>

          <!-- Available Limit -->
          <div v-if="account.availableLimit" class="panel">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm text-gray-500 mb-1">{{ t('accounts.fields.availableLimit') }}</div>
                <div class="text-2xl font-bold text-blue-600">
                  {{ formatCurrency(account.availableLimit) }}
                </div>
              </div>
              <div class="w-12 h-12 bg-info/10 rounded-full flex items-center justify-center">
                <icon-credit-card class="h-6 w-6 text-info" />
              </div>
            </div>
          </div>

          <!-- Card Number -->
          <div v-if="account.cardNumber" class="panel">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm text-gray-500 mb-1">{{ t('accounts.fields.cardNumber') }}</div>
                <div class="text-lg font-mono text-gray-700 dark:text-gray-300">
                  {{ maskCardNumber(account.cardNumber) }}
                </div>
              </div>
              <div class="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center">
                <icon-credit-card class="h-6 w-6 text-warning" />
              </div>
            </div>
          </div>
        </div>

        <!-- Account Details Panel -->
        <div class="panel mb-6">
          <div class="mb-5">
            <h6 class="text-lg font-semibold">{{ t('accounts.detail.information') }}</h6>
          </div>
          <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label class="text-sm text-gray-500">{{ t('accounts.fields.name') }}</label>
              <div class="text-base font-medium">{{ account.name }}</div>
            </div>
            <div>
              <label class="text-sm text-gray-500">{{ t('accounts.fields.type') }}</label>
              <div class="text-base font-medium">{{ accountTypeLabel(account.type) }}</div>
            </div>
            <div>
              <label class="text-sm text-gray-500">{{ t('accounts.fields.currency') }}</label>
              <div class="text-base font-medium">{{ account.currency }}</div>
            </div>
            <div>
              <label class="text-sm text-gray-500">{{ t('accounts.fields.createdDate') }}</label>
              <div class="text-base font-medium">{{ formatDateTime(account.createAt) }}</div>
            </div>
            <div>
              <label class="text-sm text-gray-500">{{ t('accounts.fields.updatedDate') }}</label>
              <div class="text-base font-medium">{{ formatDateTime(account.updateAt) }}</div>
            </div>
            <div v-if="account.createBy">
              <label class="text-sm text-gray-500">{{ t('accounts.fields.createdBy') }}</label>
              <div class="text-base font-medium">{{ account.createBy }}</div>
            </div>
          </div>
        </div>

        <!-- Balance Chart -->
        <div class="panel mb-6">
          <div class="mb-5 flex items-center justify-between">
            <h6 class="text-lg font-semibold">{{ t('accounts.detail.balanceHistory') }}</h6>
            <div class="dropdown">
              <client-only>
                <Popper :placement="store.rtlClass === 'rtl' ? 'bottom-start' : 'bottom-end'">
                  <button type="button" class="btn btn-outline-primary btn-sm">
                    <icon-horizontal-dots class="h-4 w-4" />
                  </button>
                  <template #content="{ close }">
                    <ul @click="close()">
                      <li><a href="#" @click="changeChartPeriod('7d')">{{ t('accounts.detail.period.last7Days') }}</a></li>
                      <li><a href="#" @click="changeChartPeriod('30d')">{{ t('accounts.detail.period.last30Days') }}</a></li>
                      <li><a href="#" @click="changeChartPeriod('90d')">{{ t('accounts.detail.period.last90Days') }}</a></li>
                      <li><a href="#" @click="changeChartPeriod('1y')">{{ t('accounts.detail.period.lastYear') }}</a></li>
                    </ul>
                  </template>
                </Popper>
              </client-only>
            </div>
          </div>

          <client-only>
            <apexchart v-if="chartOptions && chartSeries" height="300" :options="chartOptions" :series="chartSeries" />
            <div v-else class="flex justify-center py-20">
              <div class="text-gray-500">{{ t('accounts.detail.noChartData') }}</div>
            </div>
          </client-only>
        </div>

        <!-- Recent Transactions -->
        <div class="panel">
          <div class="mb-5 flex items-center justify-between">
            <h6 class="text-lg font-semibold">{{ t('accounts.detail.recentTransactions') }}</h6>
            <NuxtLink to="/apps/transactions" class="btn btn-outline-primary btn-sm">
              {{ t('accounts.actions.viewAllTransactions') }}
            </NuxtLink>
          </div>

          <div class="table-responsive">
            <table class="table-auto">
              <thead>
                <tr>
                  <th>{{ t('accounts.detail.date') }}</th>
                  <th>{{ t('accounts.detail.description') }}</th>
                  <th>{{ t('accounts.detail.amount') }}</th>
                  <th>{{ t('accounts.detail.balance') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="transaction in recentTransactions" :key="transaction.id">
                  <td>{{ formatDate(transaction.date) }}</td>
                  <td>{{ transaction.description }}</td>
                  <td>
                    <span class="font-semibold" :class="transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'">
                      {{ formatCurrency(transaction.amount) }}
                    </span>
                  </td>
                  <td>
                    <span class="font-semibold">
                      {{ formatCurrency(transaction.balance) }}
                    </span>
                  </td>
                </tr>
                <tr v-if="!recentTransactions.length">
                  <td colspan="4" class="text-center py-10 text-gray-500">
                    {{ t('accounts.detail.noTransactions') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <AccountModal v-model="isEditModalOpen" :account="account" :is-edit="true" @saved="handleAccountUpdated" />
  </div>
</template>

<script setup lang="ts">
import { logger } from '~/utils/logger'
import { formatDateTime } from '~/utils/display-format'

import { useAppStore } from '@/stores/index'
import { useAccounts } from '@/composables/useAccounts'
import type { Account, AccountType } from '~/types'
import type { ApiError } from '~/types/api'
import Swal from 'sweetalert2'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useAppStore()

const {
  getAccountById,
  deleteAccount,
  getAccountTypeLabelKey,
  getAccountTypeBadgeClass,
  maskCardNumber,
  formatCurrency,
  getBalanceClass,
  formatDate
} = useAccounts()

// An empty or unknown type is shown as the backend sent it.
const accountTypeLabel = (type: AccountType): string => {
  const key = getAccountTypeLabelKey(type)
  return key ? t(key) : String(type ?? '')
}

// Reactive data
const account = ref<Account | null>(null)
const isLoading = ref(true)
const isEditModalOpen = ref(false)
const chartPeriod = ref('30d')

// Mock data for demonstration
const recentTransactions = ref([
  {
    id: '1',
    date: '2024-01-15',
    description: 'Online Purchase',
    amount: -125.50,
    balance: 2874.50
  },
  {
    id: '2',
    date: '2024-01-14',
    description: 'Salary Deposit',
    amount: 3000.00,
    balance: 3000.00
  },
  {
    id: '3',
    date: '2024-01-13',
    description: 'ATM Withdrawal',
    amount: -200.00,
    balance: 0.00
  }
])

// Chart configuration
const chartOptions = computed(() => {
  if (!account.value) return null

  return {
    chart: {
      type: 'area',
      height: 300,
      toolbar: {
        show: false
      },
      zoom: {
        enabled: false
      }
    },
    colors: ['#1f2937'],
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: 2
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.1,
        stops: [0, 90, 100]
      }
    },
    grid: {
      show: true,
      borderColor: '#e0e6ed',
      strokeDashArray: 5
    },
    xaxis: {
      categories: ['Jan 1', 'Jan 5', 'Jan 10', 'Jan 15', 'Jan 20', 'Jan 25', 'Jan 30'],
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      labels: {
        formatter: (value: number) => formatCurrency(value)
      }
    },
    tooltip: {
      y: {
        formatter: (value: number) => formatCurrency(value)
      }
    }
  }
})

const chartSeries = computed(() => {
  if (!account.value) return null

  // Mock balance history data
  return [{
    name: t('accounts.detail.balance'),
    data: [2000, 2500, 2200, 2800, 2600, 2900, account.value.currentBalance]
  }]
})

// Methods
const fetchAccount = async () => {
  try {
    isLoading.value = true
    const accountId = route.params.id as string
    account.value = await getAccountById(accountId)
  } catch (error) {
    logger.error('Error fetching account:', error)
    account.value = null
  } finally {
    isLoading.value = false
  }
}

const openEditModal = () => {
  isEditModalOpen.value = true
}

const handleAccountUpdated = () => {
  isEditModalOpen.value = false
  fetchAccount()
  showSuccessMessage(t('accounts.messages.updated'))
}

const confirmDelete = async () => {
  if (!account.value) return

  const result = await Swal.fire({
    title: t('common.confirmation.title'),
    text: t('accounts.confirm.deleteIrreversible', { name: account.value.name ?? '' }),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: t('common.confirmation.yesDelete'),
    cancelButtonText: t('common.cancel')
  })

  if (result.isConfirmed) {
    try {
      await deleteAccount(account.value.id)
      showSuccessMessage(t('accounts.messages.deleted'))
      router.push('/apps/accounts')
    } catch (error) {
      logger.error('Error deleting account:', error)
      // A frontend message carries messageKey; a backend message is shown verbatim.
      const apiError = error as Partial<ApiError> | null
      showErrorMessage(apiError?.messageKey
        ? t(apiError.messageKey, apiError.messageParams ?? {})
        : apiError?.message || t('accounts.errors.deleteFailed'))
    }
  }
}

const changeChartPeriod = (period: string) => {
  chartPeriod.value = period
  // In a real app, you would fetch new chart data here
}

const showSuccessMessage = (message: string) => {
  Swal.fire({
    icon: 'success',
    title: t('common.success'),
    text: message,
    timer: 2000,
    showConfirmButton: false
  })
}

const showErrorMessage = (message: string) => {
  Swal.fire({
    icon: 'error',
    title: t('common.error'),
    text: message,
    confirmButtonText: t('common.ok')
  })
}

// Lifecycle
onMounted(() => {
  fetchAccount()
})

// SEO
useHead({
  title: computed(() => `${account.value?.name || t('accounts.detail.pageTitleFallback')} - CoreFinance`)
})
</script>
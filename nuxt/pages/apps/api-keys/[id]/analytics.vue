<template>
  <div>
    <!-- Page Header -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center space-x-3 mb-2">
          <button
            @click="$router.back()"
            class="btn btn-outline-secondary btn-sm"
          >
            <icon-arrow-left class="h-4 w-4 mr-2" />
            {{ $t('common.back') }}
          </button>
          <h5 class="font-semibold text-lg dark:text-white-light">{{ $t('apiKey.analyticsPage.title') }}</h5>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('apiKey.analyticsPage.subtitle') }} <span class="font-medium text-primary">{{ apiKey?.name || keyId }}</span>
        </p>
      </div>

      <!-- Breadcrumb -->
      <NavigationBreadcrumb :items="breadcrumbs" />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p class="text-gray-500">{{ $t('apiKey.analyticsPage.loading') }}</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="loadError" class="panel !p-8 text-center">
      <div class="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
        <icon-exclamation-triangle class="h-8 w-8 text-red-600" />
      </div>
      <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">{{ $t('apiKey.detail.loadFailedTitle') }}</h3>
      <p class="text-gray-500 mb-4">{{ errorText }}</p>
      <button @click="refreshData" class="btn btn-primary">
        <icon-arrow-path class="h-4 w-4 mr-2" />
        {{ $t('common.retry') }}
      </button>
    </div>

    <!-- Main Content -->
    <div v-else class="space-y-6">
      <!-- Advanced Stats Row -->
      <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div class="panel !p-4">
          <div class="text-center">
            <icon-users class="h-8 w-8 text-primary mx-auto mb-2" />
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('apiKey.analyticsPage.uniqueIps') }}</p>
            <p class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ formatNumber(analyticsData?.uniqueIps ?? 0) }}
            </p>
          </div>
        </div>
        
        <div class="panel !p-4">
          <div class="text-center">
            <icon-globe-alt class="h-8 w-8 text-success mx-auto mb-2" />
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('apiKey.analyticsPage.countries') }}</p>
            <p class="text-lg font-semibold text-success">
              {{ formatNumber(analyticsData?.countriesCount ?? 0) }}
            </p>
          </div>
        </div>
        
        <div class="panel !p-4">
          <div class="text-center">
            <icon-device-phone-mobile class="h-8 w-8 text-info mx-auto mb-2" />
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('apiKey.analyticsPage.userAgents') }}</p>
            <p class="text-lg font-semibold text-info">
              {{ formatNumber(analyticsData?.userAgentsCount ?? 0) }}
            </p>
          </div>
        </div>
        
        <div class="panel !p-4">
          <div class="text-center">
            <icon-clock class="h-8 w-8 text-warning mx-auto mb-2" />
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('apiKey.analyticsPage.peakHour') }}</p>
            <p class="text-lg font-semibold text-warning">
              {{ analyticsData?.peakHour || '-' }}
            </p>
          </div>
        </div>
        
        <div class="panel !p-4">
          <div class="text-center">
            <icon-shield-exclamation class="h-8 w-8 text-danger mx-auto mb-2" />
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('apiKey.analyticsPage.blocked') }}</p>
            <p class="text-lg font-semibold text-danger">
              {{ formatNumber(analyticsData?.blockedRequests ?? 0) }}
            </p>
          </div>
        </div>
        
        <div class="panel !p-4">
          <div class="text-center">
            <icon-cpu-chip class="h-8 w-8 text-secondary mx-auto mb-2" />
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('apiKey.analyticsPage.endpoints') }}</p>
            <p class="text-lg font-semibold text-secondary">
              {{ formatNumber(analyticsData?.endpointsCount ?? 0) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Dashboard Controls -->
      <div class="panel !p-4">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div class="flex items-center space-x-4">
            <h6 class="font-medium text-gray-900 dark:text-white">{{ $t('apiKey.analyticsPage.dashboard') }}</h6>
            <div v-if="refreshing" class="flex items-center space-x-2 text-sm text-gray-500">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span>{{ $t('apiKey.analyticsPage.updating') }}</span>
            </div>
          </div>
          
          <div class="flex flex-wrap items-center gap-3">
            <!-- Time Range -->
            <div class="btn-group">
              <button
                v-for="range in timeRanges"
                :key="range.value"
                @click="selectedTimeRange = range.value"
                :class="[
                  'btn btn-sm',
                  selectedTimeRange === range.value ? 'btn-primary' : 'btn-outline-primary'
                ]"
              >
                {{ $t(range.labelKey) }}
              </button>
            </div>
            
            <!-- Export Button -->
            <button class="btn btn-outline-info btn-sm">
              <icon-arrow-down-tray class="h-4 w-4 mr-2" />
              {{ $t('common.export') }}
            </button>
            
            <!-- Refresh Button -->
            <button
              @click="refreshData"
              class="btn btn-outline-secondary btn-sm"
              :disabled="refreshing"
            >
              <icon-arrow-path :class="['h-4 w-4', refreshing && 'animate-spin']" />
            </button>
          </div>
        </div>
      </div>

      <!-- Charts Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Request Volume Chart -->
        <div class="panel">
          <div class="mb-5 flex items-center justify-between">
            <h5 class="text-lg font-semibold dark:text-white-light">{{ $t('apiKey.analyticsPage.requestVolumeByHour') }}</h5>
            <div class="dropdown">
              <button type="button" class="btn btn-outline-secondary btn-sm dropdown-toggle">
                {{ $t('apiKey.analyticsPage.viewOptions') }}
              </button>
            </div>
          </div>
          
          <client-only>
            <apexchart
              :key="`volume-chart-${locale}`"
              height="350"
              type="area"
              :options="volumeChartOptions"
              :series="volumeChartData"
            />
          </client-only>
        </div>

        <!-- Geographic Distribution -->
        <div class="panel">
          <div class="mb-5 flex items-center justify-between">
            <h5 class="text-lg font-semibold dark:text-white-light">{{ $t('apiKey.analyticsPage.geographicDistribution') }}</h5>
          </div>
          
          <div class="space-y-3">
            <div v-for="country in topCountries" :key="country.code" class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="w-6 h-4 bg-gray-200 rounded-sm flex items-center justify-center">
                  <span class="text-xs">{{ country.flag }}</span>
                </div>
                <span class="text-sm font-medium">{{ country.name }}</span>
              </div>
              <div class="flex items-center space-x-3">
                <div class="w-24 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div
                    class="bg-primary h-2 rounded-full transition-all duration-300"
                    :style="{ width: `${country.percentage}%` }"
                  ></div>
                </div>
                <span class="text-sm text-gray-500 w-12 text-right">{{ formatNumber(country.requests) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Response Time Analysis -->
        <div class="panel">
          <div class="mb-5 flex items-center justify-between">
            <h5 class="text-lg font-semibold dark:text-white-light">{{ $t('apiKey.analyticsPage.responseTimeDistribution') }}</h5>
          </div>
          
          <client-only>
            <apexchart
              :key="`response-time-chart-${locale}`"
              height="350"
              type="histogram"
              :options="responseTimeChartOptions"
              :series="responseTimeChartData"
            />
          </client-only>
        </div>

        <!-- Top Endpoints -->
        <div class="panel">
          <div class="mb-5 flex items-center justify-between">
            <h5 class="text-lg font-semibold dark:text-white-light">{{ $t('apiKey.analyticsPage.popularEndpoints') }}</h5>
          </div>
          
          <div class="space-y-3">
            <div v-for="endpoint in topEndpoints" :key="endpoint.path" class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2">
                  <span :class="[
                    'px-2 py-1 text-xs rounded font-medium',
                    getMethodColor(endpoint.method)
                  ]">
                    {{ endpoint.method }}
                  </span>
                  <span class="font-mono text-sm truncate">{{ endpoint.path }}</span>
                </div>
              </div>
              <div class="flex items-center space-x-3 ml-4">
                <div class="w-20 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div
                    class="bg-success h-2 rounded-full transition-all duration-300"
                    :style="{ width: `${endpoint.percentage}%` }"
                  ></div>
                </div>
                <span class="text-sm text-gray-500 w-16 text-right">{{ formatNumber(endpoint.requests) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Security Analysis Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- IP Address Analysis -->
        <div class="panel">
          <div class="mb-5 flex items-center justify-between">
            <h5 class="text-lg font-semibold dark:text-white-light">{{ $t('apiKey.analyticsPage.ipAnalysis') }}</h5>
            <button
              @click="showIpManagement = true"
              class="btn btn-outline-primary btn-sm"
            >
              <icon-cog-6-tooth class="h-4 w-4 mr-2" />
              {{ $t('apiKey.analyticsPage.manageIps') }}
            </button>
          </div>
          
          <div class="space-y-4">
            <!-- Top IPs -->
            <div>
              <h6 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ $t('apiKey.analyticsPage.topSources') }}</h6>
              <div class="space-y-2">
                <div v-for="ip in topIPs" :key="ip.address" class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div class="flex items-center space-x-3">
                    <span class="font-mono text-sm">{{ ip.address }}</span>
                    <span :class="[
                      'px-2 py-1 text-xs rounded-full font-medium',
                      ip.status === 'whitelisted' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                      ip.status === 'blocked' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    ]">
                      {{ ip.status }}
                    </span>
                  </div>
                  <div class="text-right">
                    <span class="text-sm font-medium">{{ formatNumber(ip.requests) }}</span>
                    <span class="text-xs text-gray-500 block">{{ ip.country }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Suspicious Activity -->
            <div v-if="suspiciousActivity.length > 0">
              <h6 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                <icon-exclamation-triangle class="h-4 w-4 inline mr-1 text-warning" />
                {{ $t('apiKey.analyticsPage.suspiciousActivity') }}
              </h6>
              <div class="space-y-2">
                <div v-for="activity in suspiciousActivity" :key="activity.id" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div class="flex items-center justify-between">
                    <div>
                      <span class="font-mono text-sm">{{ activity.ip }}</span>
                      <p class="text-xs text-red-600 dark:text-red-400">{{ activity.reason }}</p>
                    </div>
                    <div class="text-right">
                      <span class="text-sm font-medium text-red-600">{{ formatNumber(activity.requests) }}</span>
                      <span class="text-xs text-gray-500 block">{{ activity.timeAgo }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Security Score Breakdown -->
        <div class="panel">
          <div class="mb-5 flex items-center justify-between">
            <h5 class="text-lg font-semibold dark:text-white-light">{{ $t('apiKey.analyticsPage.securityScoreAnalysis') }}</h5>
            <SecurityScore :api-key="apiKey" variant="compact" />
          </div>
          
          <div class="space-y-4">
            <!-- Security Factors -->
            <div>
              <h6 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ $t('apiKey.analyticsPage.securityFactors') }}</h6>
              <div class="space-y-3">
                <div v-for="factor in securityFactors" :key="factor.name" class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <icon-check-circle
                      v-if="factor.status === 'good'"
                      class="h-4 w-4 text-success"
                    />
                    <icon-exclamation-triangle
                      v-else-if="factor.status === 'warning'"
                      class="h-4 w-4 text-warning"
                    />
                    <icon-x-circle
                      v-else
                      class="h-4 w-4 text-danger"
                    />
                    <span class="text-sm">{{ factor.name }}</span>
                  </div>
                  <span class="text-sm font-medium">{{ formatNumber(factor.score) }}/{{ formatNumber(factor.maxScore) }}</span>
                </div>
              </div>
            </div>

            <!-- Recommendations -->
            <div v-if="securityRecommendations.length > 0">
              <h6 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                <icon-light-bulb class="h-4 w-4 inline mr-1 text-warning" />
                {{ $t('apiKey.analyticsPage.securityRecommendations') }}
              </h6>
              <div class="space-y-2">
                <div v-for="recommendation in securityRecommendations" :key="recommendation.id" class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p class="text-sm text-blue-800 dark:text-blue-300">{{ recommendation.message }}</p>
                  <button
                    v-if="recommendation.actionable"
                    class="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                  >
                    {{ recommendation.action }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rate Limiting Analytics -->
      <div class="panel" v-if="apiKey?.securitySettings?.enableRateLimiting">
        <div class="mb-5">
          <h5 class="text-lg font-semibold dark:text-white-light mb-2">{{ $t('apiKey.analyticsPage.rateLimitingAnalytics') }}</h5>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('apiKey.analyticsPage.rateLimitingDescription') }}
          </p>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Rate Limit Hits Over Time -->
          <div>
            <h6 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ $t('apiKey.analyticsPage.rateLimitHits') }}</h6>
            <client-only>
              <apexchart
                :key="`rate-limit-chart-${locale}`"
                height="250"
                type="bar"
                :options="rateLimitChartOptions"
                :series="rateLimitChartData"
              />
            </client-only>
          </div>

          <!-- Current Usage Status -->
          <div>
            <h6 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ $t('apiKey.analyticsPage.currentUsageStatus') }}</h6>
            <div class="space-y-4">
              <div v-if="apiKey.rateLimitPerMinute">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm">{{ $t('apiKey.analyticsPage.perMinute', { value: formatNumber(apiKey.rateLimitPerMinute) }) }}</span>
                  <span class="text-sm font-medium">{{ formatNumber(rateLimitStatus.currentMinute) }}/{{ formatNumber(apiKey.rateLimitPerMinute) }}</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div
                    :class="[
                      'h-2 rounded-full transition-all duration-300',
                      rateLimitStatus.minutePercentage > 80 ? 'bg-red-500' :
                      rateLimitStatus.minutePercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    ]"
                    :style="{ width: `${rateLimitStatus.minutePercentage}%` }"
                  ></div>
                </div>
              </div>

              <div v-if="apiKey.rateLimitPerDay">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm">{{ $t('apiKey.analyticsPage.perDay', { value: formatNumber(apiKey.rateLimitPerDay) }) }}</span>
                  <span class="text-sm font-medium">{{ formatNumber(rateLimitStatus.currentDay) }}/{{ formatNumber(apiKey.rateLimitPerDay) }}</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div
                    :class="[
                      'h-2 rounded-full transition-all duration-300',
                      rateLimitStatus.dayPercentage > 80 ? 'bg-red-500' :
                      rateLimitStatus.dayPercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    ]"
                    :style="{ width: `${rateLimitStatus.dayPercentage}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- IP Management Modal -->
    <div v-if="showIpManagement" class="fixed inset-0 z-[9999] overflow-y-auto">
      <div class="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <!-- Background overlay -->
        <div 
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          @click="showIpManagement = false"
        ></div>
        
        <!-- Modal panel -->
        <div class="inline-block align-bottom bg-white dark:bg-gray-900 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
          <!-- Modal header -->
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ $t('apiKey.analyticsPage.ipManagementTitle') }}
            </h3>
            <button
              @click="showIpManagement = false"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <icon-x-mark class="h-6 w-6" />
            </button>
          </div>
          
          <!-- Modal content -->
          <IpManagement 
            :api-key="apiKey"
            @updated="handleIpManagementUpdate"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { logger } from '~/utils/logger'
import { formatNumber } from '~/utils/display-format'

import type { ApiKey } from '~/types/api-key'
import type { ApiError } from '~/types/api'

// Charts are keyed by locale: vue3-apexcharts does not redraw labels and legends when only the options change.
const { t, locale } = useI18n()

// Meta tags
useHead({
  title: computed(() => t('apiKey.analyticsPage.metaTitle'))
})

// Route parameters
const route = useRoute()
const keyId = route.params.id as string

// Composables
const { getApiKey } = useApiKeys()

// Reactive state
const loading = ref(true)
const refreshing = ref(false)
const loadError = ref<Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null>(null)
const apiKey = ref<ApiKey | null>(null)
const showIpManagement = ref(false)

// A frontend message carries messageKey; a backend message is shown verbatim.
const errorText = computed(() => {
  const apiError = loadError.value as Partial<ApiError> | null
  return apiError?.messageKey ? t(apiError.messageKey, apiError.messageParams ?? {}) : apiError?.message || t('apiKey.errors.fetchOneFailed')
})

// Time range selection
const selectedTimeRange = ref('7d')
const timeRanges = [
  { labelKey: 'apiKey.detail.timeRange.hours24', value: '1d' },
  { labelKey: 'apiKey.detail.timeRange.days7', value: '7d' },
  { labelKey: 'apiKey.detail.timeRange.days30', value: '30d' },
  { labelKey: 'apiKey.detail.timeRange.days90', value: '90d' }
]

// Mock analytics data
const analyticsData = ref({
  uniqueIps: 127,
  countriesCount: 15,
  userAgentsCount: 8,
  peakHour: '14:00',
  blockedRequests: 23,
  endpointsCount: 12
})

// More mock data for comprehensive analytics
const topCountries = ref([
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', requests: 4521, percentage: 85 },
  { code: 'US', name: 'United States', flag: '🇺🇸', requests: 423, percentage: 65 },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', requests: 231, percentage: 45 },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', requests: 156, percentage: 30 },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', requests: 89, percentage: 18 }
])

const topEndpoints = ref([
  { method: 'GET', path: '/api/transactions', requests: 2341, percentage: 90 },
  { method: 'GET', path: '/api/accounts', requests: 1823, percentage: 70 },
  { method: 'POST', path: '/api/transactions', requests: 856, percentage: 33 },
  { method: 'GET', path: '/api/reports', requests: 534, percentage: 20 },
  { method: 'PUT', path: '/api/accounts/{id}', requests: 234, percentage: 9 }
])

const topIPs = ref([
  { address: '192.168.1.100', requests: 1234, country: 'Vietnam', status: 'whitelisted' },
  { address: '10.0.0.15', requests: 856, country: 'Vietnam', status: 'normal' },
  { address: '203.162.4.191', requests: 423, country: 'Vietnam', status: 'normal' },
  { address: '172.16.0.50', requests: 234, country: 'Singapore', status: 'blocked' }
])

const suspiciousActivity = ref([
  { 
    id: '1', 
    ip: '45.33.32.156', 
    reason: 'High request rate (500+ req/min)', 
    requests: 1250, 
    timeAgo: '5 minutes ago' 
  },
  { 
    id: '2', 
    ip: '85.25.43.83', 
    reason: 'Multiple failed authentication attempts', 
    requests: 89, 
    timeAgo: '15 minutes ago' 
  }
])

const securityFactors = ref([
  { name: 'HTTPS Required', status: 'good', score: 20, maxScore: 20 },
  { name: 'IP Validation', status: 'warning', score: 10, maxScore: 25 },
  { name: 'Rate Limiting', status: 'good', score: 15, maxScore: 15 },
  { name: 'Key Expiration', status: 'bad', score: 0, maxScore: 15 },
  { name: 'Scope Restrictions', status: 'good', score: 10, maxScore: 10 },
  { name: 'Usage Analytics', status: 'good', score: 10, maxScore: 10 }
])

const securityRecommendations = ref([
  { 
    id: '1', 
    message: 'Consider setting an expiration date for this API key to improve security.',
    actionable: true,
    action: 'Set expiration date'
  },
  { 
    id: '2', 
    message: 'Enable IP validation to restrict access to trusted sources only.',
    actionable: true,
    action: 'Configure IP whitelist'
  }
])

const rateLimitStatus = ref({
  currentMinute: 15,
  currentDay: 2341,
  minutePercentage: 15,
  dayPercentage: 23.4
})

// Breadcrumb
const breadcrumbs = computed(() => [
  { name: '', labelKey: 'apps', href: '/apps' },
  { name: '', labelKey: 'api_keys', href: '/apps/api-keys' },
  { name: '', labelKey: 'apiKey.analyticsPage.dashboard', href: '#' }
])

// Chart configurations
const volumeChartData = computed(() => [{
  name: t('apiKey.detail.requests'),
  data: [44, 55, 57, 56, 61, 58, 63, 60, 66, 78, 84, 92, 95, 88, 82, 75, 69, 65, 58, 52, 48, 46, 45, 44]
}])

const volumeChartOptions = computed(() => ({
  chart: {
    toolbar: { show: false },
    background: 'transparent'
  },
  colors: ['#00ab55'],
  stroke: { width: 2, curve: 'smooth' },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.7,
      opacityTo: 0.1
    }
  },
  xaxis: {
    categories: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
  },
  grid: { borderColor: '#e0e6ed' },
  theme: { mode: 'light' }
}))

const responseTimeChartData = computed(() => [{
  name: t('apiKey.detail.responseTime'),
  data: [23, 45, 67, 89, 123, 145, 167, 189, 234, 278, 312, 345]
}])

const responseTimeChartOptions = computed(() => ({
  chart: { toolbar: { show: false } },
  colors: ['#e2a03f'],
  xaxis: {
    title: { text: t('apiKey.analyticsPage.responseTimeAxis') }
  },
  yaxis: {
    title: { text: t('apiKey.analyticsPage.requestCountAxis') }
  }
}))

const rateLimitChartData = computed(() => [{
  name: t('apiKey.analyticsPage.rateLimitHits'),
  data: [12, 8, 15, 23, 18, 7, 11]
}])

const rateLimitChartOptions = computed(() => ({
  chart: { toolbar: { show: false } },
  colors: ['#e7515a'],
  xaxis: {
    categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  }
}))

/**
 * Methods
 */
const loadApiKey = async (): Promise<void> => {
  try {
    loading.value = true
    // Mock implementation - replace with real API call
    apiKey.value = {
      id: keyId,
      name: `Production API Key`,
      keyPrefix: 'tihomo_prod_',
      status: 'active',
      scopes: ['read:transactions', 'write:transactions', 'read:accounts'],
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: null,
      lastUsedAt: new Date().toISOString(),
      todayUsageCount: 2341,
      totalUsageCount: 45678,
      rateLimitPerMinute: 100,
      rateLimitPerDay: 10000,
      ipWhitelist: ['192.168.1.100', '10.0.0.0/24'],
      securitySettings: {
        requireHttps: true,
        enableIpValidation: true,
        enableRateLimiting: true,
        enableUsageAnalytics: true,
        corsOrigins: ['https://app.tihomo.com']
      }
    } as ApiKey
  } catch (err) {
    loadError.value = { messageKey: 'apiKey.errors.fetchOneFailed', message: 'Failed to load API key data' }
    logger.error('Error loading API key:', err)
  } finally {
    loading.value = false
  }
}

const refreshData = async (): Promise<void> => {
  refreshing.value = true
  try {
    await loadApiKey()
    // Refresh analytics data
    await new Promise(resolve => setTimeout(resolve, 1000)) // Mock delay
  } catch (err) {
    logger.error('Error refreshing data:', err)
  } finally {
    refreshing.value = false
  }
}

const getMethodColor = (method: string): string => {
  const colors = {
    GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    POST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    PATCH: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
  }
  return colors[method as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
}

const handleIpManagementUpdate = (): void => {
  showIpManagement.value = false
  refreshData()
}

/**
 * Lifecycle
 */
onMounted(() => {
  loadApiKey()
})

watch(selectedTimeRange, () => {
  refreshData()
})
</script>

<style scoped>
.btn-group {
  @apply inline-flex rounded-lg;
}

.btn-group .btn {
  @apply rounded-none border-r-0;
}

.btn-group .btn:first-child {
  @apply rounded-l-lg;
}

.btn-group .btn:last-child {
  @apply rounded-r-lg border-r;
}
</style> 
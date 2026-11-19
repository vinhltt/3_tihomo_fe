<template>
  <div class="space-y-6">
    <!-- Current IP Whitelist -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <div>
          <h4 class="text-lg font-medium text-gray-900 dark:text-white">{{ t('apiKey.ipManagement.title') }}</h4>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ t('apiKey.ipManagement.description') }}
          </p>
        </div>
        <div class="flex items-center space-x-2">
          <span :class="[
            'px-2 py-1 text-xs rounded-full font-medium',
            apiKey?.securitySettings?.enableIpValidation
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
          ]">
            {{ apiKey?.securitySettings?.enableIpValidation ? t('apiKey.ipManagement.validationOn') : t('apiKey.ipManagement.validationOff') }}
          </span>
        </div>
      </div>

      <!-- Toggle IP Validation -->
      <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <h5 class="font-medium text-blue-900 dark:text-blue-100">{{ t('apiKey.form.enableIpValidation') }}</h5>
            <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
              {{ t('apiKey.ipManagement.enableDescription') }}
            </p>
          </div>
          <label class="switch">
            <input
              v-model="ipValidationEnabled"
              type="checkbox"
              @change="toggleIpValidation"
            />
            <span class="slider round"></span>
          </label>
        </div>
      </div>

      <!-- Add New IP -->
      <div v-if="ipValidationEnabled" class="mb-6">
        <h5 class="font-medium text-gray-900 dark:text-white mb-3">{{ t('apiKey.ipManagement.addTitle') }}</h5>
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('apiKey.ipManagement.addressLabel') }}
              </label>
              <input
                v-model="newIpInput"
                type="text"
                :placeholder="t('apiKey.form.ipWhitelistPlaceholder')"
                class="form-input"
                @keyup.enter="addIpAddress"
              />
              <p class="text-xs text-gray-500 mt-1">
                {{ t('apiKey.ipManagement.addressHint') }}
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('apiKey.ipManagement.descriptionLabel') }}
              </label>
              <input
                v-model="newIpDescription"
                type="text"
                :placeholder="t('apiKey.ipManagement.descriptionPlaceholder')"
                class="form-input"
                @keyup.enter="addIpAddress"
              />
            </div>
          </div>
          
          <div class="flex items-center space-x-3">
            <button
              @click="addIpAddress"
              :disabled="!newIpInput || !isValidIpOrCidr(newIpInput)"
              class="btn btn-primary btn-sm"
            >
              <icon-plus class="h-4 w-4 mr-2" />
              {{ t('apiKey.ipManagement.addAddress') }}
            </button>
            
            <!-- Quick Add Buttons -->
            <div class="flex items-center space-x-2">
              <button
                @click="addCurrentIp"
                class="btn btn-outline-secondary btn-sm"
                :disabled="addingCurrentIp"
              >
                <icon-globe-alt class="h-4 w-4 mr-2" />
                {{ addingCurrentIp ? t('apiKey.ipManagement.detecting') : t('apiKey.ipManagement.addCurrentIp') }}
              </button>
              
              <button
                @click="showCommonRanges = true"
                class="btn btn-outline-info btn-sm"
              >
                <icon-list-bullet class="h-4 w-4 mr-2" />
                {{ t('apiKey.ipManagement.commonRanges') }}
              </button>
            </div>
          </div>

          <!-- Validation Error -->
          <div v-if="newIpInput && !isValidIpOrCidr(newIpInput)" class="text-sm text-red-600 dark:text-red-400">
            <icon-exclamation-triangle class="h-4 w-4 inline mr-1" />
            {{ t('apiKey.ipManagement.invalidAddress') }}
          </div>
        </div>
      </div>

      <!-- Current Whitelist -->
      <div v-if="ipValidationEnabled">
        <div class="flex items-center justify-between mb-3">
          <h5 class="font-medium text-gray-900 dark:text-white">
            {{ t('apiKey.ipManagement.currentWhitelist', { count: ipWhitelist.length }) }}
          </h5>
          <div class="flex items-center space-x-2">
            <!-- Bulk Actions -->
            <button
              v-if="selectedIps.length > 0"
              @click="bulkDeleteIps"
              class="btn btn-outline-danger btn-sm"
            >
              <icon-trash class="h-4 w-4 mr-2" />
              {{ t('apiKey.ipManagement.deleteSelected', { count: selectedIps.length }) }}
            </button>
            
            <button
              @click="exportWhitelist"
              class="btn btn-outline-secondary btn-sm"
            >
              <icon-arrow-down-tray class="h-4 w-4 mr-2" />
              {{ t('common.export') }}
            </button>
          </div>
        </div>

        <!-- IP List -->
        <div v-if="ipWhitelist.length > 0" class="space-y-2">
          <div
            v-for="ip in ipWhitelist"
            :key="ip.id"
            class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div class="flex items-center space-x-3">
              <input
                v-model="selectedIps"
                :value="ip.id"
                type="checkbox"
                class="form-checkbox"
              />
              <div>
                <div class="flex items-center space-x-2">
                  <span class="font-mono text-sm font-medium">{{ ip.address }}</span>
                  <span :class="[
                    'px-2 py-1 text-xs rounded-full font-medium',
                    ip.type === 'single' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                    'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                  ]">
                    {{ ip.type === 'single' ? t('apiKey.ipManagement.singleIp') : t('apiKey.ipManagement.cidrRange') }}
                  </span>
                  <span v-if="ip.isCurrentIp" class="px-2 py-1 text-xs rounded-full font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                    {{ t('apiKey.ipManagement.currentIp') }}
                  </span>
                </div>
                <div class="flex items-center space-x-4 mt-1">
                  <span v-if="ip.description" class="text-sm text-gray-600 dark:text-gray-400">
                    {{ ip.description }}
                  </span>
                  <span class="text-xs text-gray-500">
                    {{ t('apiKey.ipManagement.added', { date: formatDateTime(ip.createdAt) }) }}
                  </span>
                  <span v-if="ip.lastUsed" class="text-xs text-gray-500">
                    {{ t('apiKey.ipManagement.lastUsed', { date: formatDateTime(ip.lastUsed) }) }}
                  </span>
                </div>
              </div>
            </div>
            
            <div class="flex items-center space-x-2">
              <!-- Usage Stats -->
              <div v-if="ip.usageCount > 0" class="text-right">
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ formatNumber(ip.usageCount) }}
                </span>
                <span class="text-xs text-gray-500 block">{{ t('apiKey.card.requests') }}</span>
              </div>
              
              <!-- Actions -->
              <div class="flex items-center space-x-1">
                <button
                  @click="editIp(ip)"
                  class="btn btn-outline-secondary btn-xs"
                >
                  <icon-pencil class="h-3 w-3" />
                </button>
                <button
                  @click="deleteIp(ip.id)"
                  class="btn btn-outline-danger btn-xs"
                >
                  <icon-trash class="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <icon-shield-exclamation class="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <p class="text-gray-500">{{ t('apiKey.ipManagement.emptyTitle') }}</p>
          <p class="text-sm text-gray-400 mt-1">{{ t('apiKey.ipManagement.emptyDescription') }}</p>
        </div>
      </div>

      <!-- IP Validation Disabled Message -->
      <div v-else class="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
        <icon-globe-alt class="h-12 w-12 text-gray-400 mx-auto mb-2" />
        <p class="text-gray-500">{{ t('apiKey.ipManagement.disabledTitle') }}</p>
        <p class="text-sm text-gray-400 mt-1">{{ t('apiKey.ipManagement.disabledDescription') }}</p>
      </div>
    </div>

    <!-- Recent IP Activity -->
    <div v-if="ipValidationEnabled">
      <h5 class="font-medium text-gray-900 dark:text-white mb-3">{{ t('apiKey.ipManagement.recentActivity') }}</h5>
      <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div class="space-y-2">
          <div v-for="activity in recentIpActivity" :key="activity.id" class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div :class="[
                'w-2 h-2 rounded-full',
                activity.status === 'allowed' ? 'bg-green-500' :
                activity.status === 'blocked' ? 'bg-red-500' : 'bg-yellow-500'
              ]"></div>
              <span class="font-mono text-sm">{{ activity.ip }}</span>
              <span :class="[
                'px-2 py-1 text-xs rounded-full font-medium',
                activity.status === 'allowed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                activity.status === 'blocked' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
              ]">
                {{ activityStatusLabels[activity.status] ? t(activityStatusLabels[activity.status]) : String(activity.status ?? '') }}
              </span>
            </div>
            <div class="text-right">
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {{ formatDateTime(activity.timestamp) }}
              </span>
            </div>
          </div>
        </div>
        
        <div v-if="recentIpActivity.length === 0" class="text-center py-4">
          <p class="text-sm text-gray-500">{{ t('apiKey.ipManagement.noRecentActivity') }}</p>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
      <button
        @click="$emit('cancel')"
        class="btn btn-outline-secondary"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        @click="saveChanges"
        :disabled="!hasChanges || saving"
        class="btn btn-primary"
      >
        <icon-check class="h-4 w-4 mr-2" />
        {{ saving ? t('common.saving') : t('common.saveChanges') }}
      </button>
    </div>

    <!-- Common Ranges Modal -->
    <div v-if="showCommonRanges" class="fixed inset-0 z-[10000] overflow-y-auto">
      <div class="flex min-h-screen items-center justify-center px-4">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75" @click="showCommonRanges = false"></div>
        
        <div class="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full relative">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('apiKey.ipManagement.commonRangesTitle') }}</h3>
            <button @click="showCommonRanges = false" class="text-gray-400 hover:text-gray-600">
              <icon-x-mark class="h-5 w-5" />
            </button>
          </div>
          
          <div class="space-y-2">
            <button
              v-for="range in commonIpRanges"
              :key="range.cidr"
              @click="selectCommonRange(range)"
              class="w-full text-left p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <div class="font-mono text-sm">{{ range.cidr }}</div>
              <div class="text-xs text-gray-500">{{ t(range.descriptionKey) }}</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'
import { logger } from '~/utils/logger'
import { formatDateTime, formatNumber } from '~/utils/display-format'

import type { ApiKey } from '~/types/api-key'

// Props
interface Props {
  apiKey: ApiKey | null
}

const props = defineProps<Props>()

// Emits
interface Emits {
  (e: 'updated'): void
  (e: 'cancel'): void
}

const emit = defineEmits<Emits>()
const { t } = useI18n()

// Activity status → translation key; a status missing from the map is shown verbatim
const activityStatusLabels: Record<string, string> = {
  allowed: 'apiKey.ipManagement.activityStatus.allowed',
  blocked: 'apiKey.ipManagement.activityStatus.blocked'
}

// Reactive state
const ipValidationEnabled = ref(props.apiKey?.securitySettings?.enableIpValidation || false)
const newIpInput = ref('')
const newIpDescription = ref('')
const selectedIps = ref<string[]>([])
const showCommonRanges = ref(false)
const addingCurrentIp = ref(false)
const saving = ref(false)
const hasChanges = ref(false)

// Mock IP whitelist data
const ipWhitelist = ref([
  {
    id: '1',
    address: '192.168.1.100',
    type: 'single',
    description: 'Development machine',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    usageCount: 1234,
    isCurrentIp: false
  },
  {
    id: '2',
    address: '10.0.0.0/24',
    type: 'range',
    description: 'Office network',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    lastUsed: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    usageCount: 5678,
    isCurrentIp: false
  },
  {
    id: '3',
    address: '203.162.4.191',
    type: 'single',
    description: 'Production server',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastUsed: new Date().toISOString(),
    usageCount: 890,
    isCurrentIp: true
  }
])

const recentIpActivity = ref([
  {
    id: '1',
    ip: '192.168.1.100',
    status: 'allowed',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  },
  {
    id: '2',
    ip: '45.33.32.156',
    status: 'blocked',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  },
  {
    id: '3',
    ip: '203.162.4.191',
    status: 'allowed',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  }
])

const commonIpRanges = ref([
  { cidr: '10.0.0.0/8', descriptionKey: 'apiKey.ipManagement.ranges.classA' },
  { cidr: '172.16.0.0/12', descriptionKey: 'apiKey.ipManagement.ranges.classB' },
  { cidr: '192.168.0.0/16', descriptionKey: 'apiKey.ipManagement.ranges.classC' },
  { cidr: '127.0.0.0/8', descriptionKey: 'apiKey.ipManagement.ranges.loopback' },
  { cidr: '0.0.0.0/0', descriptionKey: 'apiKey.ipManagement.ranges.allIpv4' }
])

/**
 * Methods
 */
const isValidIpOrCidr = (input: string): boolean => {
  // Basic IP and CIDR validation
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
  
  if (ipRegex.test(input)) {
    const parts = input.split('/')
    const ip = parts[0].split('.')
    
    // Validate IP octets
    if (ip.some(octet => parseInt(octet) > 255)) return false
    
    // Validate CIDR suffix
    if (parts[1] && (parseInt(parts[1]) < 0 || parseInt(parts[1]) > 32)) return false
    
    return true
  }
  
  return ipv6Regex.test(input)
}

const addIpAddress = (): void => {
  if (!newIpInput.value || !isValidIpOrCidr(newIpInput.value)) return
  
  const newIp = {
    id: Date.now().toString(),
    address: newIpInput.value.trim(),
    type: newIpInput.value.includes('/') ? 'range' : 'single',
    description: newIpDescription.value.trim(),
    createdAt: new Date().toISOString(),
    lastUsed: null,
    usageCount: 0,
    isCurrentIp: false
  }
  
  ipWhitelist.value.push(newIp)
  newIpInput.value = ''
  newIpDescription.value = ''
  hasChanges.value = true
}

const addCurrentIp = async (): Promise<void> => {
  addingCurrentIp.value = true
  try {
    // Mock getting current IP
    await new Promise(resolve => setTimeout(resolve, 1000))
    const currentIp = '203.162.4.191' // Mock current IP
    
    newIpInput.value = currentIp
    newIpDescription.value = t('apiKey.ipManagement.currentIpDescription')
    addIpAddress()
  } catch (error) {
    logger.error('Failed to detect current IP:', error)
  } finally {
    addingCurrentIp.value = false
  }
}

const selectCommonRange = (range: typeof commonIpRanges.value[0]): void => {
  newIpInput.value = range.cidr
  newIpDescription.value = t(range.descriptionKey)
  showCommonRanges.value = false
}

const editIp = (ip: typeof ipWhitelist.value[0]): void => {
  newIpInput.value = ip.address
  newIpDescription.value = ip.description
  deleteIp(ip.id)
}

const deleteIp = (ipId: string): void => {
  ipWhitelist.value = ipWhitelist.value.filter(ip => ip.id !== ipId)
  hasChanges.value = true
}

const bulkDeleteIps = async (): Promise<void> => {
  const result = await Swal.fire({
    title: t('common.confirmation.title'),
    text: t('apiKey.ipManagement.bulkDeleteConfirm', { count: selectedIps.value.length }),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: t('common.confirmation.yesDelete'),
    cancelButtonText: t('common.cancel'),
    // The host page shows this component inside a z-[9999] modal; keep the dialog above it.
    customClass: { container: '!z-[10001]' }
  })
  if (result.isConfirmed) {
    ipWhitelist.value = ipWhitelist.value.filter(ip => !selectedIps.value.includes(ip.id))
    selectedIps.value = []
    hasChanges.value = true
  }
}

const exportWhitelist = (): void => {
  const exportData = ipWhitelist.value.map(ip => ({
    address: ip.address,
    description: ip.description,
    type: ip.type,
    createdAt: ip.createdAt,
    usageCount: ip.usageCount
  }))
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `api-key-${props.apiKey?.id}-ip-whitelist.json`
  a.click()
  URL.revokeObjectURL(url)
}

const toggleIpValidation = (): void => {
  hasChanges.value = true
}

const saveChanges = async (): Promise<void> => {
  saving.value = true
  try {
    // Mock API call to save changes
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Update the API key with new settings
    if (props.apiKey) {
      props.apiKey.securitySettings.enableIpValidation = ipValidationEnabled.value
      props.apiKey.ipWhitelist = ipWhitelist.value.map(ip => ip.address)
    }
    
    hasChanges.value = false
    emit('updated')
  } catch (error) {
    logger.error('Failed to save IP management settings:', error)
  } finally {
    saving.value = false
  }
}

/**
 * Watchers
 */
watch([ipValidationEnabled, ipWhitelist], () => {
  hasChanges.value = true
}, { deep: true })
</script>

<style scoped>
/* Toggle Switch Styles */
.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
}

input:checked + .slider {
  background-color: #00ab55;
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.slider.round {
  border-radius: 24px;
}

.slider.round:before {
  border-radius: 50%;
}
</style> 
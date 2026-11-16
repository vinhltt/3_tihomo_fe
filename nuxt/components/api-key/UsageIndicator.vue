<template>
  <div class="usage-indicator" :class="containerClasses">
    <!-- Compact View -->
    <div v-if="variant === 'compact'" class="flex items-center space-x-2">
      <!-- Usage fraction -->
      <span class="text-sm font-medium" :class="usageTextColor">
        {{ formatNumber(current) }}/{{ formatNumber(limit) }}
      </span>
      
      <!-- Mini progress bar -->
      <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 min-w-16">
        <div 
          class="h-2 rounded-full transition-all duration-300"
          :class="progressBarColor"
          :style="{ width: `${Math.min(progressPercentage, 100)}%` }"
        ></div>
      </div>
      
      <!-- Percentage -->
      <span class="text-xs text-gray-500" :class="usageTextColor">
        {{ Math.round(progressPercentage) }}%
      </span>
    </div>

    <!-- Detailed View -->
    <div v-else-if="variant === 'detailed'" class="space-y-3">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {{ title || t('apiKey.usage.statistics') }}
        </h4>
        <span 
          class="px-2 py-1 text-xs font-medium rounded-full"
          :class="statusBadgeColor"
        >
          {{ usageStatusText }}
        </span>
      </div>

      <!-- Progress bar with labels -->
      <div class="space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">{{ t('apiKey.usage.currentUsage') }}</span>
          <span class="font-medium" :class="usageTextColor">
            {{ formatNumber(current) }} / {{ formatNumber(limit) }}
          </span>
        </div>
        
        <div class="relative">
          <!-- Background bar -->
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <!-- Progress fill -->
            <div 
              class="h-3 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
              :class="progressBarColor"
              :style="{ width: `${Math.min(progressPercentage, 100)}%` }"
            >
              <!-- Animated stripe for active usage -->
              <div 
                v-if="isNearLimit" 
                class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"
              ></div>
            </div>
            
            <!-- Warning threshold line -->
            <div 
              v-if="showWarningLine"
              class="absolute top-0 w-0.5 h-3 bg-yellow-500"
              :style="{ left: `${warningThreshold}%` }"
            ></div>
          </div>
          
          <!-- Percentage label -->
          <div class="mt-1 text-right">
            <span class="text-xs font-medium" :class="usageTextColor">
              {{ t('apiKey.usage.percentUsed', { percent: Math.round(progressPercentage) }) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Rate limiting info -->
      <div v-if="rateLimit" class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('apiKey.usage.rateLimitPerMinute', { value: formatNumber(rateLimit) }) }}
      </div>
    </div>

    <!-- Card View -->
    <div v-else-if="variant === 'card'" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
      <!-- Header with icon -->
      <div class="flex items-center space-x-3">
        <div class="p-2 rounded-lg" :class="iconBgColor">
          <span class="text-lg">{{ usageIcon }}</span>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {{ title || t('apiKey.usage.apiUsage') }}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ period || t('apiKey.usage.currentPeriod') }}
          </p>
        </div>
      </div>

      <!-- Main stats -->
      <div class="grid grid-cols-2 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold" :class="usageTextColor">
            {{ formatNumber(current) }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('apiKey.usage.used') }}</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-gray-600 dark:text-gray-300">
            {{ formatNumber(limit) }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('apiKey.usage.limit') }}</div>
        </div>
      </div>

      <!-- Progress visualization -->
      <div class="space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">{{ t('apiKey.table.usage') }}</span>
          <span class="font-medium" :class="usageTextColor">
            {{ Math.round(progressPercentage) }}%
          </span>
        </div>
        
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 relative overflow-hidden">
          <div 
            class="h-4 rounded-full transition-all duration-700 ease-out"
            :class="progressBarColor"
            :style="{ width: `${Math.min(progressPercentage, 100)}%` }"
          ></div>
          
          <!-- Animated overlay for high usage -->
          <div 
            v-if="isOverLimit"
            class="absolute inset-0 bg-gradient-to-r from-red-500/20 via-red-500/10 to-red-500/20 animate-pulse"
          ></div>
        </div>
      </div>

      <!-- Additional info -->
      <div v-if="rateLimit || additionalInfo" class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <div v-if="rateLimit">{{ t('apiKey.usage.rateLimitShort', { value: formatNumber(rateLimit) }) }}</div>
        <div v-if="additionalInfo">{{ additionalInfo }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '~/utils/display-format'

// Props
interface Props {
  current: number
  limit: number
  rateLimit?: number
  variant?: 'compact' | 'detailed' | 'card'
  title?: string
  period?: string
  additionalInfo?: string
  warningThreshold?: number // Percentage (0-100)
  showWarningLine?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'compact',
  warningThreshold: 80,
  showWarningLine: false
})

const { t } = useI18n()

// Computed properties
const progressPercentage = computed(() => {
  if (props.limit === 0) return 0
  return (props.current / props.limit) * 100
})

const isNearLimit = computed(() => {
  return progressPercentage.value >= props.warningThreshold
})

const isOverLimit = computed(() => {
  return progressPercentage.value > 100
})

const usageLevel = computed(() => {
  const percentage = progressPercentage.value
  if (percentage > 100) return 'over'
  if (percentage >= props.warningThreshold) return 'warning'
  if (percentage >= 50) return 'moderate'
  return 'low'
})

const usageStatusText = computed(() => {
  const level = usageLevel.value
  switch (level) {
    case 'over': return t('apiKey.usage.level.over')
    case 'warning': return t('apiKey.usage.level.warning')
    case 'moderate': return t('apiKey.usage.level.moderate')
    case 'low': return t('apiKey.usage.level.low')
    default: return t('apiKey.usage.level.normal')
  }
})

const usageIcon = computed(() => {
  const level = usageLevel.value
  switch (level) {
    case 'over': return '🚨'
    case 'warning': return '⚠️'
    case 'moderate': return '📊'
    case 'low': return '📈'
    default: return '📊'
  }
})

// Style classes
const containerClasses = computed(() => {
  const base = ['usage-indicator']
  
  if (props.variant === 'card') {
    base.push('shadow-sm', 'hover:shadow-md', 'transition-shadow')
  }
  
  return base
})

const progressBarColor = computed(() => {
  const level = usageLevel.value
  
  switch (level) {
    case 'over':
      return ['bg-red-500', 'shadow-red-500/25']
    case 'warning':
      return ['bg-amber-500', 'shadow-amber-500/25']
    case 'moderate':
      return ['bg-blue-500', 'shadow-blue-500/25']
    case 'low':
      return ['bg-green-500', 'shadow-green-500/25']
    default:
      return ['bg-gray-400']
  }
})

const usageTextColor = computed(() => {
  const level = usageLevel.value
  
  switch (level) {
    case 'over':
      return ['text-red-600', 'dark:text-red-400']
    case 'warning':
      return ['text-amber-600', 'dark:text-amber-400']
    case 'moderate':
      return ['text-blue-600', 'dark:text-blue-400']
    case 'low':
      return ['text-green-600', 'dark:text-green-400']
    default:
      return ['text-gray-600', 'dark:text-gray-400']
  }
})

const statusBadgeColor = computed(() => {
  const level = usageLevel.value
  
  switch (level) {
    case 'over':
      return ['bg-red-100', 'text-red-800', 'dark:bg-red-900/30', 'dark:text-red-300']
    case 'warning':
      return ['bg-amber-100', 'text-amber-800', 'dark:bg-amber-900/30', 'dark:text-amber-300']
    case 'moderate':
      return ['bg-blue-100', 'text-blue-800', 'dark:bg-blue-900/30', 'dark:text-blue-300']
    case 'low':
      return ['bg-green-100', 'text-green-800', 'dark:bg-green-900/30', 'dark:text-green-300']
    default:
      return ['bg-gray-100', 'text-gray-800', 'dark:bg-gray-900/30', 'dark:text-gray-300']
  }
})

const iconBgColor = computed(() => {
  const level = usageLevel.value
  
  switch (level) {
    case 'over':
      return ['bg-red-100', 'dark:bg-red-900/30']
    case 'warning':
      return ['bg-amber-100', 'dark:bg-amber-900/30']
    case 'moderate':
      return ['bg-blue-100', 'dark:bg-blue-900/30']
    case 'low':
      return ['bg-green-100', 'dark:bg-green-900/30']
    default:
      return ['bg-gray-100', 'dark:bg-gray-900/30']
  }
})
</script>

<style scoped>
.usage-indicator {
  /* Custom animations */
  transition: all 0.3s ease-in-out;
}

/* Pulsing animation for warning states */
@keyframes warningPulse {
  0%, 100% { 
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4);
  }
  50% { 
    box-shadow: 0 0 0 8px rgba(245, 158, 11, 0);
  }
}

.usage-warning {
  animation: warningPulse 2s infinite;
}

/* Gradient animation for progress bars */
@keyframes progressShine {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

.progress-shine::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: progressShine 2s infinite;
}
</style> 
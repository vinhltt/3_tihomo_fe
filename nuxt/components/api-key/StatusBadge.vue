<template>
  <span 
    :class="badgeClasses"
    :title="statusDescription"
  >
    <!-- Status icon -->
    <span v-if="showIcon" class="mr-1.5">{{ statusIcon }}</span>
    
    <!-- Pulse indicator for active status -->
    <span 
      v-if="status === 'active' && showPulse" 
      class="w-2 h-2 bg-current rounded-full animate-pulse mr-1.5"
    ></span>
    
    <!-- Status text -->
    <span class="font-medium">{{ displayText }}</span>
    
    <!-- Expiry warning -->
    <span v-if="showExpiryWarning" class="ml-1 text-xs animate-pulse">⚠️</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ApiKeyStatus } from '~/types/api-key'
import { formatDateTime } from '~/utils/display-format'

// Props
interface Props {
  status: ApiKeyStatus | string
  showIcon?: boolean
  showPulse?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'solid' | 'outline' | 'subtle'
  expiresAt?: string // ISO date string
  customText?: string
}

const props = withDefaults(defineProps<Props>(), {
  showIcon: true,
  showPulse: false,
  size: 'sm',
  variant: 'solid'
})

const { t } = useI18n()

// Status configuration; label and description are translation keys
const statusConfig = {
  [ApiKeyStatus.Active]: {
    labelKey: 'enums.apiKeyStatus.active',
    color: 'green',
    icon: '✅',
    descriptionKey: 'apiKey.statusDescription.active'
  },
  [ApiKeyStatus.Revoked]: {
    labelKey: 'enums.apiKeyStatus.revoked',
    color: 'red',
    icon: '🚫',
    descriptionKey: 'apiKey.statusDescription.revoked'
  },
  [ApiKeyStatus.Expired]: {
    labelKey: 'enums.apiKeyStatus.expired',
    color: 'orange',
    icon: '⏰',
    descriptionKey: 'apiKey.statusDescription.expired'
  }
}

// Computed properties
const statusInfo = computed(() => {
  const config = statusConfig[props.status as ApiKeyStatus]
  if (config) {
    return { label: t(config.labelKey), color: config.color, icon: config.icon, description: t(config.descriptionKey) }
  }
  // A status missing from the map is shown verbatim, as the backend sent it.
  return {
    label: props.customText || String(props.status ?? ''),
    color: 'gray',
    icon: '❓',
    description: t('apiKey.statusDescription.unknown')
  }
})

const displayText = computed(() => {
  return props.customText || statusInfo.value.label
})

const statusDescription = computed(() => {
  if (props.status === ApiKeyStatus.Active && isExpiringSoon.value) {
    return `${statusInfo.value.description} (${t('apiKey.statusDescription.expiresSoon', { date: formatDateTime(props.expiresAt) })})`
  }
  return statusInfo.value.description
})

const statusIcon = computed(() => {
  if (!props.showIcon) return ''
  return statusInfo.value.icon
})

// Expiry logic
const isExpiringSoon = computed(() => {
  if (!props.expiresAt || props.status !== ApiKeyStatus.Active) return false
  
  const expiryDate = new Date(props.expiresAt)
  const now = new Date()
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  return daysUntilExpiry <= 7 && daysUntilExpiry > 0
})

const showExpiryWarning = computed(() => {
  return isExpiringSoon.value && props.status === ApiKeyStatus.Active
})

// Style classes
const badgeClasses = computed(() => {
  let color = statusInfo.value.color
  
  // Override color if expiring soon
  if (isExpiringSoon.value && props.status === ApiKeyStatus.Active) {
    color = 'amber'
  }
  
  const { size, variant } = props
  
  const baseClasses = [
    'inline-flex',
    'items-center',
    'rounded-full',
    'font-medium',
    'transition-all',
    'duration-200',
    'cursor-default'
  ]
  
  // Size classes
  const sizeClasses = {
    xs: ['px-1.5', 'py-0.5', 'text-xs'],
    sm: ['px-2', 'py-1', 'text-xs'],
    md: ['px-3', 'py-1.5', 'text-sm'],
    lg: ['px-4', 'py-2', 'text-base']
  }
  
  // Color and variant classes
  const colorVariantClasses = {
    solid: {
      green: ['bg-green-500', 'text-white', 'shadow-sm'],
      red: ['bg-red-500', 'text-white', 'shadow-sm'],
      orange: ['bg-orange-500', 'text-white', 'shadow-sm'],
      amber: ['bg-amber-500', 'text-white', 'shadow-sm', 'animate-pulse'],
      gray: ['bg-gray-500', 'text-white', 'shadow-sm']
    },
    outline: {
      green: [
        'border', 'border-green-500', 'text-green-600', 'bg-white',
        'hover:bg-green-50', 'dark:bg-gray-800', 'dark:text-green-400', 
        'dark:border-green-400', 'dark:hover:bg-green-900/20'
      ],
      red: [
        'border', 'border-red-500', 'text-red-600', 'bg-white',
        'hover:bg-red-50', 'dark:bg-gray-800', 'dark:text-red-400', 
        'dark:border-red-400', 'dark:hover:bg-red-900/20'
      ],
      orange: [
        'border', 'border-orange-500', 'text-orange-600', 'bg-white',
        'hover:bg-orange-50', 'dark:bg-gray-800', 'dark:text-orange-400', 
        'dark:border-orange-400', 'dark:hover:bg-orange-900/20'
      ],
      amber: [
        'border', 'border-amber-500', 'text-amber-600', 'bg-white',
        'hover:bg-amber-50', 'dark:bg-gray-800', 'dark:text-amber-400', 
        'dark:border-amber-400', 'dark:hover:bg-amber-900/20', 'animate-pulse'
      ],
      gray: [
        'border', 'border-gray-500', 'text-gray-600', 'bg-white',
        'hover:bg-gray-50', 'dark:bg-gray-800', 'dark:text-gray-400', 
        'dark:border-gray-400', 'dark:hover:bg-gray-900/20'
      ]
    },
    subtle: {
      green: [
        'bg-green-100', 'text-green-800', 'hover:bg-green-200',
        'dark:bg-green-900/30', 'dark:text-green-300'
      ],
      red: [
        'bg-red-100', 'text-red-800', 'hover:bg-red-200',
        'dark:bg-red-900/30', 'dark:text-red-300'
      ],
      orange: [
        'bg-orange-100', 'text-orange-800', 'hover:bg-orange-200',
        'dark:bg-orange-900/30', 'dark:text-orange-300'
      ],
      amber: [
        'bg-amber-100', 'text-amber-800', 'hover:bg-amber-200',
        'dark:bg-amber-900/30', 'dark:text-amber-300', 'animate-pulse'
      ],
      gray: [
        'bg-gray-100', 'text-gray-800', 'hover:bg-gray-200',
        'dark:bg-gray-900/30', 'dark:text-gray-300'
      ]
    }
  }
  
  return [
    ...baseClasses,
    ...sizeClasses[size],
    ...colorVariantClasses[variant][color as keyof typeof colorVariantClasses[typeof variant]]
  ]
})
</script>

<style scoped>
/* Custom animations */
@keyframes statusPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

.status-active {
  animation: statusPulse 2s ease-in-out infinite;
}

/* Hover effects */
.status-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.dark .status-badge:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}
</style> 
<template>
  <div class="panel">
    <div class="mb-5">
      <h5 class="font-semibold text-lg mb-2">{{ t('apiKey.actions.create') }}</h5>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('apiKey.simpleForm.description') }}
      </p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- API Key Name -->
      <div>
        <label for="apiKeyName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('apiKey.form.name') }} <span class="text-red-500">*</span>
        </label>
        <input
          id="apiKeyName"
          v-model="form.name"
          type="text"
          :placeholder="t('apiKey.form.namePlaceholder')"
          class="form-input"
          :class="{ 'border-red-500': errors.name }"
          required
          maxlength="100"
          :disabled="loading"
        />
        <p v-if="errors.name" class="text-red-500 text-xs mt-1">{{ t(errors.name) }}</p>
        <p class="text-xs text-gray-500 mt-1">
          {{ t('apiKey.form.nameHint') }}
        </p>
      </div>

      <!-- Default Settings Info -->
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div class="flex items-start">
          <icon-info-circle class="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
          <div class="text-sm">
            <h6 class="font-medium text-blue-900 dark:text-blue-200 mb-1">{{ t('apiKey.simpleForm.defaults.title') }}</h6>
            <p class="text-blue-700 dark:text-blue-300 mb-2">{{ t('apiKey.simpleForm.defaults.intro') }}</p>
            <ul class="list-disc list-inside text-blue-600 dark:text-blue-400 space-y-1 text-xs">
              <li><strong>{{ t('apiKey.simpleForm.defaults.accessLabel') }}</strong> {{ t('apiKey.simpleForm.defaults.access') }}</li>
              <li><strong>{{ t('apiKey.simpleForm.defaults.rateLimitLabel') }}</strong> {{ t('apiKey.simpleForm.defaults.rateLimit') }}</li>
              <li><strong>{{ t('apiKey.simpleForm.defaults.dailyQuotaLabel') }}</strong> {{ t('apiKey.simpleForm.defaults.dailyQuota') }}</li>
              <li><strong>{{ t('apiKey.simpleForm.defaults.securityLabel') }}</strong> {{ t('apiKey.simpleForm.defaults.security') }}</li>
              <li><strong>{{ t('apiKey.simpleForm.defaults.expirationLabel') }}</strong> {{ t('apiKey.simpleForm.defaults.expiration') }}</li>
            </ul>
            <p class="text-blue-600 dark:text-blue-400 text-xs mt-2">
              {{ t('apiKey.simpleForm.advancedLater') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Submit Button -->
      <div class="flex items-center justify-between pt-4">
        <button
          type="button"
          @click="$emit('cancel')"
          class="btn btn-outline-primary"
          :disabled="loading"
        >
          {{ t('common.cancel') }}
        </button>
        
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="loading || !form.name.trim()"
        >
          <icon-lock v-if="!loading" class="w-4 h-4 mr-2" />
          <div v-else class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          {{ loading ? t('apiKey.form.creating') : t('apiKey.actions.create') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { logger } from '~/utils/logger'

import type { CreateSimpleApiKeyRequest } from '~/types/api-key'

// Props & Emits
interface Props {
  loading?: boolean
}

interface Emits {
  (e: 'submit', data: CreateSimpleApiKeyRequest): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<Emits>()
const { t } = useI18n()

// Form state
const form = reactive<CreateSimpleApiKeyRequest>({
  name: ''
})

// Translation key of the name validation message; empty means valid.
const errors = reactive({
  name: ''
})

// Methods
const validateForm = (): boolean => {
  errors.name = ''
  
  if (!form.name.trim()) {
    errors.name = 'apiKey.validation.nameRequired'
    return false
  }
  
  if (form.name.length < 3) {
    errors.name = 'apiKey.validation.nameMinLength'
    return false
  }
  
  if (form.name.length > 100) {
    errors.name = 'apiKey.validation.nameMaxLength'
    return false
  }
  
  return true
}

const handleSubmit = () => {
  if (!validateForm()) return
  
  emit('submit', { ...form })
}

// Reset form when component is created/reset
const resetForm = () => {
  form.name = ''
  errors.name = ''
}

// Debug
onMounted(() => {
  logger.dev('SimpleApiKeyForm mounted')
})

// Expose reset method
defineExpose({
  resetForm
})
</script>

<style scoped>
.form-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
</style>
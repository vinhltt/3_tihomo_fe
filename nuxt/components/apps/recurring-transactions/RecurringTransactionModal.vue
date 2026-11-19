<template>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                    {{ isEditMode ? t('recurring.modal.editTitle') : t('recurring.modal.createTitle') }}
                </h3>
                <button 
                    type="button" 
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    @click="$emit('close')"
                >
                    <icon-x class="w-6 h-6" />
                </button>
            </div>

            <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
                <div v-if="saveError" role="alert" class="rounded-lg border border-danger/20 bg-danger/10 p-3 text-danger">
                    <p>{{ saveErrorText }}</p>
                    <ul v-if="validationErrors.length" class="mt-2 list-disc pl-5">
                        <li v-for="(message, index) in validationErrors" :key="index">{{ message }}</li>
                    </ul>
                </div>
                <!-- Basic Information -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">{{ t('recurring.fields.name') }} *</label>
                        <input 
                            v-model="form.name" 
                            type="text" 
                            class="form-input" 
                            :placeholder="t('recurring.placeholders.name')"
                            required
                        />
                    </div>
                    <div>
                        <label class="form-label">{{ t('transactions.fields.account') }} *</label>
                        <select v-model="form.accountId" class="form-select" :disabled="accountLoading || !!accountError || loading" required>
                            <option value="">{{ t('transactions.placeholders.selectAccount') }}</option>
                            <option v-for="account in accounts" :key="account.id" :value="account.id">
                                {{ account.name }}
                            </option>
                        </select>
                        <p v-if="accountLoading" class="mt-1 text-sm text-gray-500">{{ t('accounts.dropdown.loading') }}</p>
                        <div v-else-if="accountError" role="alert" class="mt-1 text-sm text-danger">
                            <p>{{ t('accounts.errors.loadFailedDetail', { error: accountErrorText }) }}</p>
                            <button type="button" class="mt-2 btn btn-sm btn-outline-primary" @click="$emit('retry-accounts')">{{ t('common.retry') }}</button>
                        </div>
                        <p v-else-if="accounts.length === 0" class="mt-1 text-sm text-warning">{{ t('recurring.modal.noAccounts') }}</p>
                    </div>
                </div>

                <div>
                    <label class="form-label">{{ t('transactions.fields.description') }}</label>
                    <textarea 
                        v-model="form.description" 
                        class="form-textarea" 
                        rows="3"
                        :placeholder="t('recurring.placeholders.description')"
                    ></textarea>
                </div>

                <!-- Transaction Details -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">{{ t('transactions.fields.direction') }} *</label>
                        <select v-model="form.transactionType" class="form-select" required>
                            <option :value="0">{{ t('enums.transactionType.income') }}</option>
                            <option :value="1">{{ t('enums.transactionType.expense') }}</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">{{ t('transactions.fields.amount') }} *</label>
                        <input 
                            v-model.number="form.amount" 
                            type="number" 
                            step="0.01"
                            min="0"
                            class="form-input" 
                            placeholder="0.00"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label class="form-label">{{ t('transactions.fields.category') }}</label>
                    <input 
                        v-model="form.category" 
                        type="text" 
                        class="form-input" 
                        :placeholder="t('recurring.placeholders.category')"
                    />
                </div>

                <!-- Frequency Settings -->
                <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">{{ t('recurring.modal.frequencySection') }}</h4>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="form-label">{{ t('recurring.fields.repeatFrequency') }} *</label>
                            <select v-model="form.frequency" class="form-select" required @change="handleFrequencyChange">
                                <option :value="RecurrenceFrequency.Daily">{{ t('enums.recurrenceFrequency.daily') }}</option>
                                <option :value="RecurrenceFrequency.Weekly">{{ t('enums.recurrenceFrequency.weekly') }}</option>
                                <option :value="RecurrenceFrequency.Biweekly">{{ t('enums.recurrenceFrequency.biweekly') }}</option>
                                <option :value="RecurrenceFrequency.Monthly">{{ t('enums.recurrenceFrequency.monthly') }}</option>
                                <option :value="RecurrenceFrequency.Quarterly">{{ t('enums.recurrenceFrequency.quarterly') }}</option>
                                <option :value="RecurrenceFrequency.SemiAnnually">{{ t('enums.recurrenceFrequency.semiAnnually') }}</option>
                                <option :value="RecurrenceFrequency.Annually">{{ t('enums.recurrenceFrequency.annually') }}</option>
                                <option :value="RecurrenceFrequency.Custom">{{ t('enums.recurrenceFrequency.custom') }}</option>
                            </select>
                        </div>
                        <div v-if="form.frequency === RecurrenceFrequency.Custom">
                            <label class="form-label">{{ t('recurring.fields.customIntervalDays') }} *</label>
                            <input 
                                v-model.number="form.customIntervalDays" 
                                type="number" 
                                min="1"
                                class="form-input" 
                                :placeholder="t('recurring.placeholders.days')"
                                required
                            />
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                            <label class="form-label">{{ t('recurring.fields.startDate') }} *</label>
                            <input 
                                v-model="form.startDate" 
                                type="date" 
                                class="form-input" 
                                required
                            />
                        </div>
                        <div>
                            <label class="form-label">{{ t('recurring.fields.endDate') }}</label>
                            <input 
                                v-model="form.endDate" 
                                type="date" 
                                class="form-input"
                            />
                        </div>
                    </div>
                </div>

                <!-- Advanced Settings -->
                <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">{{ t('recurring.modal.advancedSection') }}</h4>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="form-label">{{ t('recurring.fields.daysInAdvance') }}</label>
                            <input 
                                v-model.number="form.daysInAdvance" 
                                type="number" 
                                min="1"
                                max="365"
                                class="form-input" 
                                placeholder="30"
                            />
                            <p class="text-xs text-gray-500 mt-1">{{ t('recurring.fields.daysInAdvanceHint') }}</p>
                        </div>
                        <div class="space-y-3">
                            <label class="flex items-center">
                                <input 
                                    v-model="form.isActive" 
                                    type="checkbox" 
                                    class="form-checkbox"
                                />
                                <span class="ml-2 text-sm">{{ t('recurring.fields.isActive') }}</span>
                            </label>
                            <label class="flex items-center">
                                <input 
                                    v-model="form.autoGenerate" 
                                    type="checkbox" 
                                    class="form-checkbox"
                                />
                                <span class="ml-2 text-sm">{{ t('recurring.fields.autoGenerate') }}</span>
                            </label>
                        </div>
                    </div>

                    <div class="mt-4">
                        <label class="form-label">{{ t('transactions.fields.note') }}</label>
                        <textarea 
                            v-model="form.notes" 
                            class="form-textarea" 
                            rows="3"
                            :placeholder="t('recurring.placeholders.notes')"
                        ></textarea>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <button 
                        type="button" 
                        class="btn btn-outline-secondary"
                        @click="$emit('close')"
                    >
                        {{ t('common.cancel') }}
                    </button>
                    <button 
                        type="submit" 
                        class="btn btn-primary"
                        :disabled="loading || accountLoading || !!accountError || !accounts.some(account => account.id === form.accountId)"
                    >
                        <div v-if="loading" class="inline-block animate-spin border-2 border-transparent border-l-white rounded-full w-4 h-4 mr-2"></div>
                        {{ isEditMode ? t('common.update') : t('recurring.modal.create') }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRecurringTransactions } from '~/composables/useRecurringTransactions'
import type { RecurringTransactionTemplateViewModel, RecurringTransactionTemplateCreateRequest, RecurringTransactionTemplateUpdateRequest } from '~/types'
import { RecurrenceFrequency } from '~/types'
import IconX from '~/components/icon/icon-x.vue'
import type { AccountSelection } from '~/types/account'
import type { ApiError } from '~/types/api'
import { useAuthStore } from '~/stores/auth'
import { errorMessage } from '~/utils/expected-transaction-formatters'

// Props
interface Props {
    template?: RecurringTransactionTemplateViewModel | null
    accounts: readonly AccountSelection[]
    accountLoading?: boolean
    accountError?: Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null
}

const props = withDefaults(defineProps<Props>(), {
    template: null,
    accountLoading: false,
    accountError: null
})

// Emits
const emit = defineEmits<{
    close: []
    saved: []
    'retry-accounts': []
}>()

// Composables
const { createTemplate, updateTemplate } = useRecurringTransactions()
const auth = useAuthStore()
const { t } = useI18n()
let disposed = false

// Reactive data
const loading = ref(false)
const saveError = ref<Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null>(null)
const validationErrors = ref<string[]>([])
const form = ref({
    accountId: '',
    name: '',
    description: '',
    amount: 0,
    transactionType: 1, // Default to Expense
    category: '',
    frequency: RecurrenceFrequency.Monthly,
    customIntervalDays: null as number | null | undefined,
    startDate: '',
    endDate: '',
    cronExpression: '',
    isActive: true,
    autoGenerate: true,
    daysInAdvance: 30,
    notes: ''
})

// Computed
const isEditMode = computed(() => !!props.template)
// A frontend message carries messageKey; a backend message is shown verbatim.
const saveErrorText = computed(() => {
    const apiError = saveError.value
    return apiError?.messageKey ? t(apiError.messageKey, apiError.messageParams ?? {}) : apiError?.message || t('recurring.errors.saveFailed')
})
const accountErrorText = computed(() => {
    const apiError = props.accountError
    return apiError?.messageKey ? t(apiError.messageKey, apiError.messageParams ?? {}) : apiError?.message || t('accounts.errors.loadFailed')
})

// Methods
const handleFrequencyChange = () => {
    if (form.value.frequency !== RecurrenceFrequency.Custom) {
        form.value.customIntervalDays = null
    }
}

const resetForm = () => {
    saveError.value = null
    validationErrors.value = []
    if (props.template) {
        // Edit mode - populate form with template data
        form.value = {
            accountId: props.template.accountId,
            name: props.template.name,
            description: props.template.description || '',
            amount: props.template.amount,
            transactionType: props.template.transactionType,
            category: props.template.category || '',
            frequency: props.template.frequency,
            customIntervalDays: props.template.customIntervalDays,
            startDate: props.template.startDate.split('T')[0], // Convert to date format
            endDate: props.template.endDate ? props.template.endDate.split('T')[0] : '',
            cronExpression: props.template.cronExpression || '',
            isActive: props.template.isActive,
            autoGenerate: props.template.autoGenerate,
            daysInAdvance: props.template.daysInAdvance,
            notes: props.template.notes || ''
        }
    } else {
        // Create mode - set default values
        const today = new Date().toISOString().split('T')[0]
        form.value = {
            accountId: '',
            name: '',
            description: '',
            amount: 0,
            transactionType: 1,
            category: '',
            frequency: RecurrenceFrequency.Monthly,
            customIntervalDays: null,
            startDate: today,
            endDate: '',
            cronExpression: '',
            isActive: true,
            autoGenerate: true,
            daysInAdvance: 30,
            notes: ''
        }
    }
}

const handleSubmit = async () => {
    if (!auth.isAuthenticated || !auth.token || loading.value || props.accountLoading || props.accountError || !props.accounts.some(account => account.id === form.value.accountId)) return
    const token = auth.token
    saveError.value = null
    validationErrors.value = []
    try {
        loading.value = true
        
        const requestData = {
            ...form.value,
            endDate: form.value.endDate || null,
            description: form.value.description || null,
            category: form.value.category || null,
            cronExpression: form.value.cronExpression || null,
            notes: form.value.notes || null
        }

        if (isEditMode.value && props.template) {
            // Update existing template
            const updateRequest: RecurringTransactionTemplateUpdateRequest = {
                ...requestData,
                id: props.template.id
            }
            await updateTemplate(props.template.id, updateRequest)
        } else {
            // Create new template
            const createRequest: RecurringTransactionTemplateCreateRequest = requestData
            await createTemplate(createRequest)
        }

        if (!disposed && auth.isAuthenticated && auth.token === token) emit('saved')
    } catch (error) {
        if (disposed || !auth.isAuthenticated || auth.token !== token) return
        const apiError = error as Partial<ApiError>
        saveError.value = errorMessage(error, 'recurring.errors.saveFailed')
        validationErrors.value = Object.values(apiError.errors || {}).flat()
    } finally {
        if (!disposed && auth.token === token) loading.value = false
    }
}

// Watchers
watch(() => props.template, () => {
    resetForm()
}, { immediate: true })

// Lifecycle
onMounted(() => {
    resetForm()
})

onBeforeUnmount(() => {
    disposed = true
})
</script>

<style scoped>
.form-label {
    @apply block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1;
}

.form-input {
    @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white;
}

.form-select {
    @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white;
}

.form-textarea {
    @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white resize-none;
}

.form-checkbox {
    @apply h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 rounded;
}
</style> 
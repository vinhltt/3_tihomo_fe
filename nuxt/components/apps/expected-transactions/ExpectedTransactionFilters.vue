<template>
    <section class="panel">
        <h2 class="mb-4 text-lg font-semibold">{{ t('common.filters') }}</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div>
                <label for="expected-status" class="mb-1 block text-sm font-medium">{{ t('common.status') }}</label>
                <select id="expected-status" v-model="displayStatus" class="form-select">
                    <option value="">{{ t('expected.filters.allStatuses') }}</option>
                    <option :value="ExpectedTransactionDisplayStatus.Pending">{{ t('enums.expectedTransactionStatus.pending') }}</option>
                    <option :value="ExpectedTransactionDisplayStatus.Overdue">{{ t('enums.expectedTransactionStatus.overdue') }}</option>
                    <option :value="ExpectedTransactionDisplayStatus.Confirmed">{{ t('enums.expectedTransactionStatus.confirmed') }}</option>
                    <option :value="ExpectedTransactionDisplayStatus.Cancelled">{{ t('enums.expectedTransactionStatus.cancelled') }}</option>
                    <option :value="ExpectedTransactionDisplayStatus.Completed">{{ t('enums.expectedTransactionStatus.completed') }}</option>
                </select>
            </div>
            <div>
                <label for="expected-from-date" class="mb-1 block text-sm font-medium">{{ t('transactions.filters.fromDate') }}</label>
                <input id="expected-from-date" v-model="dateFrom" type="date" class="form-input" />
            </div>
            <div>
                <label for="expected-to-date" class="mb-1 block text-sm font-medium">{{ t('transactions.filters.toDate') }}</label>
                <input id="expected-to-date" v-model="dateTo" type="date" class="form-input" />
            </div>
            <div>
                <label for="expected-template" class="mb-1 block text-sm font-medium">{{ t('expected.filters.template') }}</label>
                <select id="expected-template" v-model="templateId" class="form-select" :disabled="templatesLoading || !!templatesError">
                    <option value="">{{ t('expected.filters.allTemplates') }}</option>
                    <option v-for="option in templateOptions" :key="option.id" :value="option.id">{{ option.name || t('expected.template.unnamed') }}</option>
                </select>
                <p v-if="templatesLoading" role="status" class="mt-1 text-sm text-gray-500">{{ t('expected.filters.templatesLoading') }}</p>
                <p v-else-if="!templatesError && templateOptions.length === 0" class="mt-1 text-sm text-gray-500">{{ t('expected.filters.noTemplates') }}</p>
            </div>
            <div class="flex items-end">
                <button type="button" class="btn btn-outline-secondary w-full" @click="emit('reset')">{{ t('common.clearFilters') }}</button>
            </div>
        </div>
        <p v-if="dateRangeError" role="alert" class="mt-4 rounded-lg border border-danger/20 bg-danger/10 p-3 text-danger">{{ t('expected.filters.dateRangeInvalid') }}</p>
        <div v-if="templatesError" role="alert" class="mt-4 rounded-lg border border-danger/20 bg-danger/10 p-3 text-danger">
            <p>{{ t('expected.filters.templatesLoadFailed', { error: templatesError }) }}</p>
            <button type="button" class="btn btn-sm btn-outline-primary mt-2" @click="emit('retry-templates')">{{ t('expected.filters.retryTemplates') }}</button>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ExpectedTransactionDisplayStatus } from '~/types/recurring-transaction'
import type { ExpectedTransactionFilterForm, RecurringTransactionTemplateViewModel } from '~/types/recurring-transaction'

// Presentational: the page owns filter state, validation (dateRangeError) and every request.
// templatesError is the resolved error text; the page translates it so it follows a locale switch.
const props = defineProps<{
    modelValue: ExpectedTransactionFilterForm
    templateOptions: Array<Pick<RecurringTransactionTemplateViewModel, 'id' | 'name'>>
    templatesLoading: boolean
    templatesError: string | null
    dateRangeError: boolean
}>()
const emit = defineEmits<{
    'update:modelValue': [filters: ExpectedTransactionFilterForm]
    reset: []
    'retry-templates': []
}>()

const { t } = useI18n()

// Each edit emits a new form object; the page's watcher resets to page 1 and reloads once.
const field = <K extends keyof ExpectedTransactionFilterForm>(key: K) => computed({
    get: () => props.modelValue[key],
    set: (value: ExpectedTransactionFilterForm[K]) => emit('update:modelValue', { ...props.modelValue, [key]: value })
})
const displayStatus = field('displayStatus')
const dateFrom = field('dateFrom')
const dateTo = field('dateTo')
const templateId = field('templateId')
</script>

<template>
    <section class="panel">
        <h2 class="mb-4 text-lg font-semibold">{{ t('common.filters') }}</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
                <label for="debt-filter-direction" class="mb-1 block text-sm font-medium">{{ t('debts.fields.direction') }}</label>
                <select id="debt-filter-direction" v-model="direction" class="form-select">
                    <option value="">{{ t('debts.filters.allDirections') }}</option>
                    <option v-for="(key, value) in DEBT_DIRECTION_KEYS" :key="value" :value="value">{{ t(key) }}</option>
                </select>
            </div>
            <div>
                <label for="debt-filter-status" class="mb-1 block text-sm font-medium">{{ t('common.status') }}</label>
                <select id="debt-filter-status" v-model="status" class="form-select">
                    <option value="">{{ t('debts.filters.allStatuses') }}</option>
                    <option v-for="(key, value) in DEBT_STATUS_KEYS" :key="value" :value="value">{{ t(key) }}</option>
                </select>
            </div>
            <div class="flex items-end">
                <button type="button" class="btn btn-outline-secondary w-full" @click="emit('reset')">{{ t('common.clearFilters') }}</button>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DebtFilterForm } from '~/types/debt'
import { DEBT_DIRECTION_KEYS, DEBT_STATUS_KEYS } from '~/utils/debt-formatters'

// Presentational: the page owns the filter state and every request.
const props = defineProps<{ modelValue: DebtFilterForm }>()
const emit = defineEmits<{
    'update:modelValue': [filters: DebtFilterForm]
    reset: []
}>()

const { t } = useI18n()

// Each edit emits a new form object; the page's watcher resets to page 1 and reloads once.
const field = <K extends keyof DebtFilterForm>(key: K) => computed({
    get: () => props.modelValue[key],
    set: (value: DebtFilterForm[K]) => emit('update:modelValue', { ...props.modelValue, [key]: value })
})
const direction = field('direction')
const status = field('status')
</script>

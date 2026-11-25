<template>
    <div class="space-y-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
                <h1 class="break-words text-2xl font-semibold dark:text-white-light">{{ debt.name }}</h1>
                <span class="badge mt-2 inline-block" :class="debtStatusClass(debt.status)">{{ labelText(DEBT_STATUS_KEYS, debt.status) }}</span>
            </div>
            <div class="flex flex-wrap gap-2">
                <button v-if="provisioning && !isDebtBusy(debt)" type="button" class="btn btn-sm btn-outline-primary" :disabled="disabled" @click="emit('retry')">{{ t('common.retry') }}</button>
                <template v-if="!provisioning">
                    <button v-if="hasPaymentActions(debt)" type="button" class="btn btn-sm btn-primary" :disabled="disabled || !canRecordPayment(debt)" @click="emit('pay')">
                        {{ debt.direction === 'Borrow' ? t('debts.payment.recordBorrow') : t('debts.payment.recordLend') }}
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-primary" :disabled="disabled || !canEditDebt(debt)" @click="emit('edit')">{{ t('common.edit') }}</button>
                    <button type="button" class="btn btn-sm btn-outline-warning" :disabled="disabled || !canCloseDebt(debt)" @click="emit('close')">{{ t('debts.close.action') }}</button>
                </template>
                <button type="button" class="btn btn-sm btn-outline-danger" :disabled="disabled || !canDeleteDebt(debt)" @click="emit('delete')">
                    {{ provisioning ? t('common.cancel') : t('common.delete') }}
                </button>
            </div>
        </div>

        <DebtPendingSyncAlert :debt="debt" detailed :disabled="disabled" @resync="emit('retry')" />

        <dl class="panel grid gap-4 sm:grid-cols-2 lg:grid-cols-3" :aria-busy="loading">
            <div v-for="[key, value] in facts" :key="key">
                <dt class="text-sm text-gray-500">{{ t(key) }}</dt>
                <dd class="mt-1 whitespace-pre-line break-words font-semibold">{{ value }}</dd>
            </div>
        </dl>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DebtPendingSyncAlert from '~/components/apps/debts/DebtPendingSyncAlert.vue'
import type { Debt } from '~/types/debt'
import {
    DEBT_DIRECTION_KEYS,
    DEBT_STATUS_KEYS,
    DEBT_TYPE_KEYS,
    canCloseDebt,
    canDeleteDebt,
    canEditDebt,
    debtLabel,
    debtStatusClass,
    formatDebtAmount,
    isDebtBusy
} from '~/utils/debt-formatters'
import { canRecordPayment, hasPaymentActions } from '~/utils/debt-payment-rules'
import { formatDate, formatNumber } from '~/utils/display-format'

// Presentational: the page owns the read and every action. disabled is set while an action runs.
const props = defineProps<{ debt: Debt; loading: boolean; disabled: boolean }>()
const emit = defineEmits<{
    retry: []
    pay: []
    edit: []
    close: []
    delete: []
}>()

const { t } = useI18n()

const labelText = (keys: Record<string, string>, value: string): string => {
    const label = debtLabel(keys, value)
    return 'raw' in label ? label.raw : t(label.key)
}
const provisioning = computed(() => props.debt.status === 'Provisioning')
const facts = computed((): Array<[string, string]> => {
    const value = props.debt
    return [
        ['debts.fields.direction', labelText(DEBT_DIRECTION_KEYS, value.direction)],
        ['debts.fields.type', labelText(DEBT_TYPE_KEYS, value.debtType)],
        ['debts.fields.counterparty', value.counterparty || '-'],
        ['debts.fields.originalAmount', formatDebtAmount(value.originalAmount)],
        ['debts.fields.initialBalance', formatDebtAmount(value.initialBalance)],
        ['debts.fields.currentBalance', formatDebtAmount(value.currentBalance)],
        ['debts.fields.progress', `${formatNumber(value.progress)}%`],
        ['debts.fields.interestRate', formatNumber(value.interestRate)],
        ['debts.fields.startDate', formatDate(value.startDate)],
        ['debts.fields.description', value.description || '-'],
        ['debts.fields.notes', value.notes || '-']
    ]
})
</script>

<template>
    <section role="status" aria-live="polite" class="panel border border-success/30 bg-success/10">
        <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 space-y-2">
                <h2 class="font-semibold text-success">{{ successMessage(payload.mode) }}</h2>
                <p class="break-all text-sm">{{ t('expected.fields.periodId') }}: {{ payload.expectedTransactionId }}</p>
                <div v-if="payload.payment" class="space-y-1">
                    <p class="break-all"><strong>{{ t('expected.success.savedActualTransactionId') }}:</strong> {{ payload.payment.actualTransactionId }}</p>
                    <p><strong>{{ t('transactions.fields.transactionDate') }}:</strong> {{ formatDate(payload.payment.actualTransaction.transactionDate) }}</p>
                    <p v-if="payload.payment.actualTransaction.revenueAmount > 0">
                        <strong>{{ t('expected.success.incomeAmount') }}:</strong> {{ formatCurrency(payload.payment.actualTransaction.revenueAmount) }}
                    </p>
                    <p v-if="payload.payment.actualTransaction.spentAmount > 0">
                        <strong>{{ t('expected.success.expenseAmount') }}:</strong> {{ formatCurrency(payload.payment.actualTransaction.spentAmount) }}
                    </p>
                    <p class="text-sm">{{ t('expected.success.balanceNote') }}</p>
                </div>
                <p class="text-sm">{{ t('expected.success.savedNote') }}</p>
            </div>
            <button type="button" class="btn btn-sm btn-outline-success shrink-0" @click="emit('dismiss')">{{ t('expected.success.dismiss') }}</button>
        </div>
    </section>
</template>

<script setup lang="ts">
import type { ActionMode, CommittedPayload } from '~/types/recurring-transaction'
import { formatCurrency, formatDate } from '~/utils/expected-transaction-formatters'

defineProps<{ payload: CommittedPayload }>()
const emit = defineEmits<{ dismiss: [] }>()

const { t } = useI18n()

const successMessage = (mode: ActionMode): string => {
    switch (mode) {
        case 'payment': return t('expected.success.payment')
        case 'link': return t('expected.success.link')
        case 'cancel': return t('expected.success.cancel')
        case 'adjust': return t('expected.success.adjust')
    }
}
</script>

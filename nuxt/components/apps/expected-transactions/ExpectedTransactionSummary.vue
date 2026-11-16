<template>
    <div class="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
        <h3 class="font-semibold">{{ labelText(templateLabel(transaction)) }}</h3>
        <p v-if="transaction.description" class="mt-1 whitespace-pre-wrap text-sm">{{ transaction.description }}</p>
        <p class="mt-2 break-all text-xs text-gray-500">{{ t('expected.fields.periodId') }}: {{ transaction.id }}</p>
        <p class="mt-1 text-sm">{{ t('common.status') }}: {{ labelText(statusLabel(transaction.displayStatus)) }}</p>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <p><strong>{{ t('expected.fields.currentAmount') }}:</strong> {{ formatCurrency(transaction.expectedAmount) }}</p>
            <p><strong>{{ t('expected.fields.originalAmount') }}:</strong> {{ formatCurrency(transaction.originalAmount ?? transaction.expectedAmount) }}</p>
            <p><strong>{{ t('expected.fields.expectedDate') }}:</strong> {{ formatDate(transaction.expectedDate) }}</p>
            <p><strong>{{ t('transactions.fields.type') }}:</strong> {{ labelText(typeLabel(transaction.transactionType)) }}</p>
        </div>
        <p v-if="transaction.isAdjusted" class="mt-2 text-sm text-warning">{{ t('expected.summary.adjustedNote') }}</p>
        <p v-if="transaction.adjustmentReason" class="mt-2 whitespace-pre-wrap text-sm">{{ t('expected.fields.savedReason') }}: {{ transaction.adjustmentReason }}</p>
        <p v-if="transaction.processedAt" class="mt-2 text-sm">{{ t('expected.fields.processedTime') }}: {{ formatTimestamp(transaction.processedAt) }}</p>
        <p v-if="transaction.actualTransactionId" class="mt-1 break-all text-sm">{{ t('expected.fields.linkedActualTransaction') }}: {{ transaction.actualTransactionId }}</p>
    </div>
</template>

<script setup lang="ts">
import type { ExpectedTransactionViewModel } from '~/types/recurring-transaction'
import { formatCurrency, formatDate, formatTimestamp, statusLabel, templateLabel, typeLabel } from '~/utils/expected-transaction-formatters'
import type { DisplayLabel } from '~/utils/expected-transaction-formatters'

defineProps<{ transaction: ExpectedTransactionViewModel }>()

const { t } = useI18n()

// A key is translated; a raw backend value or template name is shown verbatim.
const labelText = (label: DisplayLabel): string => ('raw' in label ? label.raw : t(label.key, label.params ?? {}))
</script>

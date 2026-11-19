<template>
    <section class="panel" :aria-busy="loading">
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-lg font-semibold">{{ t('expected.list.heading') }}</h2>
            <button type="button" class="btn btn-sm btn-outline-primary" :disabled="loading || !authenticated" @click="emit('reload')">{{ t('expected.list.reload') }}</button>
        </div>
        <p class="mb-4 text-sm text-gray-500">{{ t('expected.list.notice') }}</p>

        <div v-if="loading" role="status" class="py-12 text-center text-gray-500">{{ t('expected.list.loading') }}</div>
        <div v-else-if="listError" role="alert" class="rounded-lg border border-danger/20 bg-danger/10 p-4 text-danger">
            <p v-if="listErrorAfterCommit">{{ t('expected.list.reloadAfterCommitFailed', { error: listError }) }}</p>
            <p v-else>{{ t('expected.list.loadFailed', { error: listError }) }}</p>
            <button type="button" class="btn btn-sm btn-outline-primary mt-3" @click="emit('reload')">{{ t('expected.list.retry') }}</button>
        </div>
        <p v-else-if="!authenticated" class="py-12 text-center text-gray-500">{{ t('expected.list.signInRequired') }}</p>
        <p v-else-if="dateRangeError" class="py-12 text-center text-gray-500">{{ t('expected.list.invalidDateRange') }}</p>
        <p v-else-if="transactions.length === 0" class="py-12 text-center text-gray-500">{{ t('expected.list.empty') }}</p>
        <div v-else class="table-responsive">
            <table class="table-hover">
                <thead>
                    <tr>
                        <th>{{ t('expected.columns.periodTemplate') }}</th>
                        <th>{{ t('expected.fields.expectedDate') }}</th>
                        <th>{{ t('expected.columns.accountType') }}</th>
                        <th>{{ t('transactions.fields.amount') }}</th>
                        <th>{{ t('common.status') }}</th>
                        <th>{{ t('expected.columns.processing') }}</th>
                        <th>{{ t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="transaction in transactions" :key="transaction.id" :class="{ 'bg-primary/10': highlightedId === transaction.id }">
                        <td class="min-w-[180px] max-w-xs">
                            <p class="font-semibold">{{ labelText(templateLabel(transaction)) }}</p>
                            <p v-if="transaction.description" class="mt-1 whitespace-pre-wrap text-sm">{{ transaction.description }}</p>
                            <p v-if="transaction.category" class="mt-1 text-xs text-gray-500">{{ t('transactions.fields.category') }}: {{ transaction.category }}</p>
                            <p class="mt-1 break-all text-xs text-gray-500">{{ t('expected.fields.periodId') }}: {{ transaction.id }}</p>
                        </td>
                        <td class="whitespace-nowrap">
                            <p>{{ formatDate(transaction.expectedDate) }}</p>
                            <p v-if="isPending(transaction)" class="mt-1 text-xs" :class="transaction.daysUntilDue < 0 ? 'text-danger' : 'text-gray-500'">
                                {{ labelText(dueMessage(transaction.daysUntilDue)) }}
                            </p>
                        </td>
                        <td>
                            <p>{{ transaction.accountName || (transaction.accountId ? t('expected.account.unavailable') : t('expected.account.none')) }}</p>
                            <p class="mt-1 text-sm text-gray-500">{{ labelText(typeLabel(transaction.transactionType)) }}</p>
                        </td>
                        <td class="whitespace-nowrap">
                            <p class="font-semibold">{{ formatCurrency(transaction.expectedAmount) }}</p>
                            <p v-if="transaction.isAdjusted" class="mt-1 text-xs text-warning">{{ t('expected.fields.adjusted') }}</p>
                            <p v-if="transaction.originalAmount != null" class="mt-1 text-xs text-gray-500">{{ t('expected.fields.originalAmount') }}: {{ formatCurrency(transaction.originalAmount) }}</p>
                        </td>
                        <td>
                            <span class="badge whitespace-nowrap" :class="statusClass(transaction.displayStatus)">{{ labelText(statusLabel(transaction.displayStatus)) }}</span>
                        </td>
                        <td class="min-w-[180px] max-w-xs text-sm">
                            <p>{{ t('expected.fields.generatedAt') }}: {{ formatTimestamp(transaction.generatedAt) }}</p>
                            <p class="mt-1">{{ t('expected.fields.processedAt') }}: {{ formatTimestamp(transaction.processedAt) }}</p>
                            <p v-if="transaction.actualTransactionId" class="mt-1 break-all">{{ t('expected.fields.actualTransaction') }}: {{ transaction.actualTransactionId }}</p>
                            <p v-if="transaction.adjustmentReason" class="mt-1 whitespace-pre-wrap">{{ t('expected.fields.reason') }}: {{ transaction.adjustmentReason }}</p>
                            <p v-if="transaction.notes" class="mt-1 whitespace-pre-wrap text-gray-500">{{ t('transactions.fields.note') }}: {{ transaction.notes }}</p>
                        </td>
                        <td class="min-w-[220px]">
                            <div v-if="isPending(transaction)" class="flex flex-wrap gap-2">
                                <button v-if="isIncomeExpense(transaction)" type="button" class="btn btn-sm btn-outline-success" @click="emit('open', transaction, 'payment')">{{ t('expected.actions.payment') }}</button>
                                <button type="button" class="btn btn-sm btn-outline-primary" @click="emit('open', transaction, 'link')">{{ t('expected.actions.link') }}</button>
                                <button v-if="isIncomeExpense(transaction)" type="button" class="btn btn-sm btn-outline-warning" @click="emit('open', transaction, 'adjust')">{{ t('expected.actions.adjust') }}</button>
                                <button type="button" class="btn btn-sm btn-outline-danger" @click="emit('open', transaction, 'cancel')">{{ t('expected.actions.cancel') }}</button>
                            </div>
                            <p v-else class="text-sm text-gray-500">{{ t('expected.list.processed') }}</p>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="!loading && !listError && !dateRangeError && pagination.totalRow > 0" class="mt-5 flex flex-wrap items-center justify-between gap-4">
            <p class="text-sm text-gray-500">{{ t('expected.pagination.summary', { from: firstRow, to: lastRow, total: pagination.totalRow }) }}</p>
            <div class="flex items-center gap-2">
                <button type="button" class="btn btn-sm btn-outline-primary" :disabled="pagination.pageIndex <= 1" @click="emit('change-page', pagination.pageIndex - 1)">{{ t('common.previous') }}</button>
                <span class="text-sm">{{ t('transactions.pagination.page', { current: pagination.pageIndex, total: pagination.pageCount }) }}</span>
                <button type="button" class="btn btn-sm btn-outline-primary" :disabled="pagination.pageIndex >= pagination.pageCount" @click="emit('change-page', pagination.pageIndex + 1)">{{ t('common.next') }}</button>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Pagination } from '~/types/api'
import type { ActionMode, ExpectedTransactionViewModel } from '~/types/recurring-transaction'
import {
    dueMessage,
    formatCurrency,
    formatDate,
    formatTimestamp,
    isIncomeExpense,
    isPending,
    statusClass,
    statusLabel,
    templateLabel,
    typeLabel
} from '~/utils/expected-transaction-formatters'
import type { DisplayLabel } from '~/utils/expected-transaction-formatters'

// Presentational: the page owns loading, paging requests and the action guard behind 'open'.
// listError is the resolved error text; the page translates it so it follows a locale switch.
const props = defineProps<{
    transactions: ExpectedTransactionViewModel[]
    pagination: Pagination
    loading: boolean
    listError: string | null
    listErrorAfterCommit: boolean
    authenticated: boolean
    dateRangeError: boolean
    highlightedId: string | null
}>()
const emit = defineEmits<{
    open: [transaction: ExpectedTransactionViewModel, mode: ActionMode]
    'change-page': [page: number]
    reload: []
}>()

const { t } = useI18n()

// A key is translated (with its plural count when present); a raw backend value is shown verbatim.
const labelText = (label: DisplayLabel): string => {
    if ('raw' in label) return label.raw
    return label.plural === undefined ? t(label.key, label.params ?? {}) : t(label.key, label.params ?? {}, label.plural)
}
const firstRow = computed(() => (props.pagination.pageIndex - 1) * props.pagination.pageSize + 1)
const lastRow = computed(() => Math.min(props.pagination.pageIndex * props.pagination.pageSize, props.pagination.totalRow))
</script>

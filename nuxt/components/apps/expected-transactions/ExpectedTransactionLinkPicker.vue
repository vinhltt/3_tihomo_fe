<template>
    <div>
        <label for="actual-search" class="mb-1 block text-sm font-medium">{{ t('expected.link.search') }}</label>
        <input id="actual-search" v-model="search" type="search" class="form-input" :placeholder="t('expected.link.searchPlaceholder')" :disabled="saving" />
        <p class="mt-1 text-sm text-gray-500">{{ t('expected.link.hint') }}</p>
    </div>
    <div :aria-busy="loading">
        <p v-if="loading" role="status" class="py-6 text-center text-gray-500">{{ t('expected.link.loading') }}</p>
        <div v-else-if="error" role="alert" class="rounded-lg bg-danger/10 p-3 text-danger">
            <p>{{ t('expected.link.loadFailed', { error: errorText }) }}</p>
            <button type="button" class="btn btn-sm btn-outline-primary mt-2" :disabled="saving" @click="load()">{{ t('expected.link.retry') }}</button>
        </div>
        <p v-else-if="rows.length === 0" class="py-6 text-center text-gray-500">{{ t('expected.link.empty') }}</p>
        <div v-else class="table-responsive">
            <table class="table-hover">
                <thead>
                    <tr><th>{{ t('expected.link.select') }}</th><th>{{ t('transactions.fields.date') }}</th><th>{{ t('expected.link.descriptionId') }}</th><th>{{ t('enums.transactionDirection.revenue') }}</th><th>{{ t('enums.transactionDirection.spent') }}</th></tr>
                </thead>
                <tbody>
                    <tr v-for="actual in rows" :key="actual.id" :class="selected?.id === actual.id ? 'bg-primary/10' : ''">
                        <td>
                            <input
                                type="radio"
                                name="actual-transaction"
                                class="form-radio"
                                :checked="selected?.id === actual.id"
                                :aria-label="t('expected.link.selectTransaction', { id: actual.id })"
                                :disabled="saving || conflictBlocked"
                                @change="emit('selected', actual)"
                            />
                        </td>
                        <td class="whitespace-nowrap">{{ formatDate(actual.transactionDate) }}</td>
                        <td class="max-w-xs">
                            <p>{{ actual.description || t('transactions.confirm.noDescription') }}</p>
                            <p v-if="actual.categorySummary" class="mt-1 text-xs text-gray-500">{{ actual.categorySummary }}</p>
                            <p class="mt-1 break-all text-xs text-gray-500">{{ actual.id }}</p>
                        </td>
                        <td class="whitespace-nowrap text-success">{{ formatCurrency(actual.revenueAmount) }}</td>
                        <td class="whitespace-nowrap text-danger">{{ formatCurrency(actual.spentAmount) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div v-if="!loading && !error && pagination.totalRow > 0" class="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>{{ t('transactions.pagination.summary', { from: firstRow, to: lastRow, total: pagination.totalRow }) }}</p>
            <div class="flex items-center gap-2">
                <button type="button" class="btn btn-sm btn-outline-primary" :disabled="saving || pagination.pageIndex <= 1" @click="load(pagination.pageIndex - 1)">{{ t('common.previous') }}</button>
                <span>{{ t('transactions.pagination.page', { current: pagination.pageIndex, total: pagination.pageCount }) }}</span>
                <button type="button" class="btn btn-sm btn-outline-primary" :disabled="saving || pagination.pageIndex >= pagination.pageCount" @click="load(pagination.pageIndex + 1)">{{ t('common.next') }}</button>
            </div>
        </div>
    </div>
    <div v-if="selected" class="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
        <p class="break-all font-semibold">{{ t('expected.link.selected') }}: {{ selected.id }}</p>
        <p class="mt-1">{{ t('transactions.fields.date') }}: {{ formatDate(selected.transactionDate) }}</p>
        <p class="mt-1">{{ t('enums.transactionDirection.revenue') }}: {{ formatCurrency(selected.revenueAmount) }} · {{ t('enums.transactionDirection.spent') }}: {{ formatCurrency(selected.spentAmount) }}</p>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTransactions } from '~/composables/useTransactions'
import type { ApiError, Pagination } from '~/types/api'
import type { TransactionViewModel } from '~/types/transaction'
import { errorMessage, formatCurrency, formatDate } from '~/utils/expected-transaction-formatters'

// Owns the actual-transaction read. The modal mounts it only for a current session and owns the selection and submit.
const props = defineProps<{ sessionKey: number; saving: boolean; conflictBlocked: boolean; selected: TransactionViewModel | null }>()
const emit = defineEmits<{
    selected: [actual: TransactionViewModel | null]
    // Loading or failed reads block submit even when a selection from another page is kept.
    blocked: [blocked: boolean]
}>()

const { searchTransactions } = useTransactions()
const emptyPagination = (): Pagination => ({ pageIndex: 1, pageSize: 10, totalRow: 0, pageCount: 0 })
const search = ref('')
const rows = ref<TransactionViewModel[]>([])
const loading = ref(true)
const error = ref<Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null>(null)
const pagination = ref<Pagination>(emptyPagination())
let disposed = false
let sequence = 0
let controller: AbortController | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null

const { t } = useI18n()

// A frontend message carries messageKey; a backend message is shown verbatim.
const errorText = computed(() => {
    const apiError = error.value
    return apiError?.messageKey ? t(apiError.messageKey, apiError.messageParams ?? {}) : apiError?.message || t('expected.errors.retryTransactions')
})
const firstRow = computed(() => (pagination.value.pageIndex - 1) * pagination.value.pageSize + 1)
const lastRow = computed(() => Math.min(pagination.value.pageIndex * pagination.value.pageSize, pagination.value.totalRow))

const invalidate = (): void => {
    sequence += 1
    controller?.abort()
    controller = null
    if (searchTimer !== null) clearTimeout(searchTimer)
    searchTimer = null
}

const load = async (page = pagination.value.pageIndex): Promise<void> => {
    invalidate()
    if (disposed) return
    const requestSequence = sequence
    const requestKey = props.sessionKey
    const requestController = new AbortController()
    controller = requestController
    const isCurrent = () => !disposed && props.sessionKey === requestKey && requestSequence === sequence && !requestController.signal.aborted
    const pageCount = pagination.value.pageCount
    const pageIndex = pageCount > 0 ? Math.min(Math.max(page, 1), pageCount) : 1
    loading.value = true
    error.value = null
    try {
        const response = await searchTransactions(search.value.trim(), pageIndex, pagination.value.pageSize, requestController.signal)
        if (!isCurrent()) return
        rows.value = response.data
        pagination.value = response.pagination
    } catch (err) {
        if (isCurrent()) error.value = errorMessage(err, 'expected.errors.retryTransactions')
    } finally {
        if (isCurrent()) {
            loading.value = false
            controller = null
        }
    }
}

watch(() => loading.value || !!error.value, blocked => emit('blocked', blocked), { flush: 'sync' })
watch(() => props.sessionKey, invalidate, { flush: 'sync' })
watch(search, () => {
    if (disposed) return
    invalidate()
    rows.value = []
    emit('selected', null)
    error.value = null
    pagination.value = { ...emptyPagination(), pageSize: pagination.value.pageSize }
    loading.value = true
    searchTimer = setTimeout(() => {
        searchTimer = null
        void load(1)
    }, 300)
}, { flush: 'sync' })

onMounted(() => {
    void load(1)
})
onBeforeUnmount(() => {
    disposed = true
    invalidate()
})
</script>

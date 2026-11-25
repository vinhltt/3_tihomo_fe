<template>
    <div class="space-y-4">
        <p v-if="noAccounts" role="alert" class="text-sm text-warning">{{ t('debts.picker.noVndAccounts') }}</p>
        <div v-else>
            <label for="debt-transaction-search" class="mb-1 block text-sm font-medium">{{ t('expected.link.search') }}</label>
            <input id="debt-transaction-search" v-model="search" type="search" class="form-input" :placeholder="t('expected.link.searchPlaceholder')" />
            <p class="mt-1 text-sm text-gray-500">{{ outgoing ? t('debts.picker.outgoingHint') : t('debts.picker.incomingHint') }}</p>
        </div>
        <div v-if="!noAccounts" :aria-busy="loading">
            <p v-if="loading" role="status" class="py-6 text-center text-gray-500">{{ t('expected.link.loading') }}</p>
            <div v-else-if="error" role="alert" class="rounded-lg bg-danger/10 p-3 text-danger">
                <p>{{ t('expected.link.loadFailed', { error: errorText }) }}</p>
                <button type="button" class="btn btn-sm btn-outline-primary mt-2" @click="load()">{{ t('expected.link.retry') }}</button>
            </div>
            <p v-else-if="rows.length === 0" class="py-6 text-center text-gray-500">{{ t('expected.link.empty') }}</p>
            <div v-else class="table-responsive">
                <table class="table-hover">
                    <thead>
                        <tr>
                            <th>{{ t('expected.link.select') }}</th>
                            <th>{{ t('transactions.fields.date') }}</th>
                            <th>{{ t('expected.link.descriptionId') }}</th>
                            <th>{{ t('debts.fields.transactionAmount') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="actual in rows" :key="actual.id" :class="selected?.id === actual.id ? 'bg-primary/10' : ''">
                            <td>
                                <input
                                    type="radio"
                                    name="debt-transaction"
                                    class="form-radio"
                                    :checked="selected?.id === actual.id"
                                    :aria-label="t('expected.link.selectTransaction', { id: actual.id })"
                                    @change="emit('selected', actual)"
                                />
                            </td>
                            <td class="whitespace-nowrap">{{ formatDate(actual.transactionDate) }}</td>
                            <td class="max-w-xs">
                                <p class="break-words">{{ actual.description || t('transactions.confirm.noDescription') }}</p>
                                <p v-if="actual.categorySummary" class="mt-1 text-xs text-gray-500">{{ actual.categorySummary }}</p>
                                <p class="mt-1 break-all text-xs text-gray-500">{{ actual.id }}</p>
                            </td>
                            <td class="whitespace-nowrap">{{ formatDebtAmount(getAmount(actual)) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div v-if="!loading && !error && pagination.totalRow > 0" class="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                <p>{{ t('transactions.pagination.summary', { from: firstRow, to: lastRow, total: pagination.totalRow }) }}</p>
                <div class="flex items-center gap-2">
                    <button type="button" class="btn btn-sm btn-outline-primary" :disabled="pagination.pageIndex <= 1" @click="load(pagination.pageIndex - 1)">{{ t('common.previous') }}</button>
                    <span>{{ t('transactions.pagination.page', { current: pagination.pageIndex, total: pagination.pageCount }) }}</span>
                    <button type="button" class="btn btn-sm btn-outline-primary" :disabled="pagination.pageIndex >= pagination.pageCount" @click="load(pagination.pageIndex + 1)">{{ t('common.next') }}</button>
                </div>
            </div>
        </div>
        <div v-if="selected" class="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
            <p class="break-all font-semibold">{{ t('expected.link.selected') }}: {{ selected.id }}</p>
            <p class="mt-1">{{ t('transactions.fields.date') }}: {{ formatDate(selected.transactionDate) }}</p>
            <p class="mt-1">{{ t('debts.fields.transactionAmount') }}: {{ formatDebtAmount(getAmount(selected)) }}</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAccountsSimple } from '~/composables/useAccountsSimple'
import { useTransactions } from '~/composables/useTransactions'
import { useAuthStore } from '~/stores/auth'
import type { Pagination } from '~/types/api'
import type { DebtDisplayError } from '~/types/debt'
import { getAmount } from '~/types/transaction'
import type { TransactionViewModel } from '~/types/transaction'
import { formatDebtAmount, isVndAccount } from '~/utils/debt-formatters'
import { debtTransactionFilter } from '~/utils/debt-payment-rules'
import { errorMessage, formatDate } from '~/utils/expected-transaction-formatters'

// Owns the read of the VND accounts and of their one-sided transactions. The dialog owns the selection and submit, and its
// fieldset disables every control here. Another side needs another mount.
const props = defineProps<{ outgoing: boolean; selected: TransactionViewModel | null }>()
const emit = defineEmits<{
    selected: [actual: TransactionViewModel | null]
    // Loading or failed reads block submit even when a selection from another page is kept.
    blocked: [blocked: boolean]
}>()

const auth = useAuthStore()
const { accounts, error: accountError, getAccounts } = useAccountsSimple()
const { searchTransactions } = useTransactions()
const emptyPagination = (): Pagination => ({ pageIndex: 1, pageSize: 10, totalRow: 0, pageCount: 0 })
const search = ref('')
const rows = ref<TransactionViewModel[]>([])
const loading = ref(true)
const error = ref<DebtDisplayError | null>(null)
const noAccounts = ref(false)
const pagination = ref<Pagination>(emptyPagination())
const openingToken = auth.token
let disposed = false
let sequence = 0
let controller: AbortController | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null

const { t } = useI18n()

// A frontend message carries messageKey; a backend message is shown verbatim.
const errorText = computed(() => (error.value?.messageKey ? t(error.value.messageKey, error.value.messageParams ?? {}) : error.value?.message))
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
    const requestController = new AbortController()
    controller = requestController
    const isCurrent = () =>
        !disposed && requestSequence === sequence && auth.isAuthenticated && auth.token === openingToken && !requestController.signal.aborted
    const pageCount = pagination.value.pageCount
    const pageIndex = pageCount > 0 ? Math.min(Math.max(page, 1), pageCount) : 1
    loading.value = true
    error.value = null
    try {
        if (accounts.value.length === 0) await getAccounts(requestController.signal)
        if (!isCurrent()) return
        // The helper resolves Promise<void>; failures are exposed through its error ref.
        if (accountError.value) throw accountError.value
        const accountIds = accounts.value.filter(isVndAccount).map(account => account.id)
        noAccounts.value = accountIds.length === 0
        if (noAccounts.value) return
        const filter = debtTransactionFilter(accountIds, props.outgoing)
        const response = await searchTransactions(search.value.trim(), pageIndex, pagination.value.pageSize, requestController.signal, filter)
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
watch(() => [auth.token, auth.isAuthenticated], invalidate, { flush: 'sync' })
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
    // The dialog may still hold the state of an earlier mount.
    emit('blocked', true)
    void load(1)
})
onBeforeUnmount(() => {
    disposed = true
    invalidate()
})
</script>

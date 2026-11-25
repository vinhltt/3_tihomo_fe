<template>
    <div class="space-y-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
                <h1 class="text-2xl font-semibold dark:text-white-light">{{ t('expected_transactions') }}</h1>
                <p class="mt-1 text-gray-500">{{ t('expected.description') }}</p>
            </div>
            <NuxtLink to="/apps/recurring-transactions" class="btn btn-outline-primary">{{ t('expected.manageTemplates') }}</NuxtLink>
        </div>

        <ExpectedTransactionSuccessPanel v-if="success" :payload="success" @dismiss="success = null" />

        <ExpectedTransactionFiltersPanel
            v-model="filters"
            :template-options="templateOptions"
            :templates-loading="templatesLoading"
            :templates-error="templatesErrorText"
            :date-range-error="dateRangeError"
            @reset="resetFilters"
            @retry-templates="loadTemplateOptions"
        />

        <section v-if="(targetLoading && !queryTarget) || targetError || (queryTarget && (isDebtLinked(queryTarget) || !isPending(queryTarget)))" class="panel">
            <p v-if="targetLoading && !queryTarget" role="status" class="text-gray-500">{{ t('expected.target.loading') }}</p>
            <div v-else-if="targetError" role="alert" class="text-danger">
                <p>{{ t('expected.target.loadFailed', { error: errorText(targetError) }) }}</p>
                <button type="button" class="btn btn-sm btn-outline-primary mt-2" @click="loadQueryTarget()">{{ t('expected.target.retry') }}</button>
            </div>
            <div v-else-if="queryTarget && isDebtLinked(queryTarget)" class="space-y-2 text-sm">
                <p class="font-semibold">{{ isPending(queryTarget) ? t('expected.target.handledAtDebt') : t('expected.target.processed') }}</p>
                <p class="break-words">
                    <NuxtLink :to="`/apps/debts/${encodeURIComponent(queryTarget.debtId)}`" class="text-primary hover:underline">{{ queryTarget.debtName || t('debts.detail.title') }}</NuxtLink>
                    · {{ formatDate(queryTarget.expectedDate) }} · {{ formatDebtAmount(queryTarget.expectedAmount) }}
                </p>
                <p v-if="queryTarget.debtCounterparty" class="break-words">{{ t('debts.fields.counterparty') }}: {{ queryTarget.debtCounterparty }}</p>
                <p class="break-all">{{ t('expected.fields.periodId') }}: {{ queryTarget.id }}</p>
            </div>
            <div v-else-if="queryTarget" class="space-y-2 text-sm">
                <p class="font-semibold">{{ t('expected.target.processed') }}</p>
                <p>{{ queryTarget.templateName || t('expected.template.none') }} · {{ formatDate(queryTarget.expectedDate) }} · {{ formatCurrency(queryTarget.expectedAmount) }}</p>
                <p class="break-all">{{ t('expected.fields.periodId') }}: {{ queryTarget.id }}</p>
                <p v-if="queryTarget.actualTransactionId" class="break-all">{{ t('expected.fields.actualTransaction') }}: {{ queryTarget.actualTransactionId }}</p>
            </div>
        </section>

        <ExpectedTransactionTable
            :transactions="transactions"
            :pagination="pagination"
            :loading="loading"
            :list-error="listErrorText"
            :list-error-after-commit="listErrorAfterCommit"
            :authenticated="auth.isAuthenticated"
            :date-range-error="dateRangeError"
            :highlighted-id="queryTarget?.id ?? null"
            @open="openAction"
            @change-page="changePage"
            @reload="loadTransactions()"
        />

        <ExpectedTransactionActionModal
            v-if="selectedTransaction && actionMode"
            :key="`${selectedTransaction.id}:${actionMode}`"
            :transaction="selectedTransaction"
            :mode="actionMode"
            @close="closeAction"
            @committed="handleCommitted"
            @canonical="handleCanonical"
        />
    </div>
</template>


<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useHead, useRoute } from '#imports'
import ExpectedTransactionActionModal from '~/components/apps/expected-transactions/ExpectedTransactionActionModal.vue'
import ExpectedTransactionFiltersPanel from '~/components/apps/expected-transactions/ExpectedTransactionFilters.vue'
import ExpectedTransactionSuccessPanel from '~/components/apps/expected-transactions/ExpectedTransactionSuccessPanel.vue'
import ExpectedTransactionTable from '~/components/apps/expected-transactions/ExpectedTransactionTable.vue'
import { useExpectedTransactions } from '~/composables/useExpectedTransactions'
import { useAuthStore } from '~/stores/auth'
import type { ApiError, Pagination } from '~/types/api'
import type {
    ActionMode,
    CommittedPayload,
    ExpectedTransactionFilterForm,
    ExpectedTransactionFilters,
    ExpectedTransactionViewModel,
    RecurringTransactionTemplateViewModel
} from '~/types/recurring-transaction'
import { formatDebtAmount } from '~/utils/debt-formatters'
import { errorMessage, formatCurrency, formatDate, isDebtLinked, isIncomeExpense, isPending } from '~/utils/expected-transaction-formatters'

const auth = useAuthStore()
const route = useRoute()
const { getExpectedTransactions, getExpectedTransaction, getTemplateOptions, revision, notifyMutation } = useExpectedTransactions()
const emptyPagination = (): Pagination => ({ pageIndex: 1, pageSize: 10, totalRow: 0, pageCount: 0 })
const emptyFilters = (): ExpectedTransactionFilterForm => ({ displayStatus: '', dateFrom: '', dateTo: '', templateId: '' })
const filters = ref<ExpectedTransactionFilterForm>(emptyFilters())
const transactions = ref<ExpectedTransactionViewModel[]>([])
const pagination = ref<Pagination>(emptyPagination())
const loading = ref(false)
const listError = ref<Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null>(null)
const listErrorAfterCommit = ref(false)
const dateRangeError = ref(false)
const templateOptions = ref<Array<Pick<RecurringTransactionTemplateViewModel, 'id' | 'name'>>>([])
const templatesLoading = ref(false)
const templatesError = ref<Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null>(null)
const selectedTransaction = ref<ExpectedTransactionViewModel | null>(null)
const actionMode = ref<ActionMode | null>(null)
const success = ref<CommittedPayload | null>(null)
const queryTarget = ref<ExpectedTransactionViewModel | null>(null)
const targetLoading = ref(false)
const targetError = ref<Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null>(null)
let mounted = false
let disposed = false
let resettingSession = false
// Set only by an on-page commit, consumed by the refresh that commit triggers.
let pendingCommitRefresh = false
let listSequence = 0
let templateSequence = 0
let listController: AbortController | null = null
let templateController: AbortController | null = null
let targetSequence = 0
let targetController: AbortController | null = null
const queryId = computed(() => {
    const id = route.query.id
    return typeof id === 'string' ? id : Array.isArray(id) ? id[0] || '' : ''
})

const { t } = useI18n()

// A frontend message carries messageKey; a backend message is shown verbatim. Resolved at render, so it follows a locale switch.
const errorText = (error: Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null): string | null =>
    error ? (error.messageKey ? t(error.messageKey, error.messageParams ?? {}) : error.message) : null
const listErrorText = computed(() => errorText(listError.value))
const templatesErrorText = computed(() => errorText(templatesError.value))

useHead({ title: computed(() => t('expected_transactions')) })

const loadTransactions = async (page = pagination.value.pageIndex, afterCommit = false): Promise<void> => {
    const sequence = ++listSequence
    listController?.abort()
    listController = null
    if (!mounted || disposed || !auth.isAuthenticated || !auth.token) return

    listError.value = null
    listErrorAfterCommit.value = false
    dateRangeError.value = false
    if (filters.value.dateFrom && filters.value.dateTo && filters.value.dateFrom > filters.value.dateTo) {
        // A filter validation error, not a load failure: no request and no retry.
        transactions.value = []
        loading.value = false
        dateRangeError.value = true
        return
    }

    const requestToken = auth.token
    const controller = new AbortController()
    listController = controller
    const isCurrent = () => !disposed && mounted && sequence === listSequence &&
        auth.isAuthenticated && auth.token === requestToken && !controller.signal.aborted
    const pageCount = pagination.value.pageCount
    const safePage = pageCount > 0 ? Math.min(Math.max(page, 1), pageCount) : 1
    const requestFilters: ExpectedTransactionFilters = {
        displayStatus: filters.value.displayStatus === '' ? undefined : filters.value.displayStatus,
        dateFrom: filters.value.dateFrom || undefined,
        dateTo: filters.value.dateTo || undefined,
        templateId: filters.value.templateId || undefined
    }
    loading.value = true
    try {
        const response = await getExpectedTransactions(requestFilters, safePage, pagination.value.pageSize, controller.signal)
        if (!isCurrent()) return
        transactions.value = response.data
        pagination.value = response.pagination
    } catch (error) {
        if (!isCurrent()) return
        listError.value = errorMessage(error, 'expected.errors.retryList')
        listErrorAfterCommit.value = afterCommit
    } finally {
        if (isCurrent()) {
            loading.value = false
            listController = null
        }
    }
}

const loadTemplateOptions = async (): Promise<void> => {
    const sequence = ++templateSequence
    templateController?.abort()
    templateController = null
    if (!mounted || disposed || !auth.isAuthenticated || !auth.token) return
    const requestToken = auth.token
    const controller = new AbortController()
    templateController = controller
    const isCurrent = () => !disposed && mounted && sequence === templateSequence &&
        auth.isAuthenticated && auth.token === requestToken && !controller.signal.aborted
    templatesLoading.value = true
    templatesError.value = null
    try {
        const options = await getTemplateOptions(controller.signal)
        if (isCurrent()) templateOptions.value = options
    } catch (error) {
        if (isCurrent()) templatesError.value = errorMessage(error, 'expected.errors.retryTemplates')
    } finally {
        if (isCurrent()) {
            templatesLoading.value = false
            templateController = null
        }
    }
}

const resetFilters = (): void => { filters.value = emptyFilters() }
const changePage = (page: number): void => { if (!loading.value) void loadTransactions(page) }
const closeAction = (): void => {
    actionMode.value = null
    selectedTransaction.value = null
}
const openAction = (transaction: ExpectedTransactionViewModel, mode: ActionMode): void => {
    if (!auth.isAuthenticated || !auth.token || !isPending(transaction) || isDebtLinked(transaction)) return
    if ((mode === 'payment' || mode === 'adjust') && !isIncomeExpense(transaction)) return
    selectedTransaction.value = transaction
    actionMode.value = mode
}

const loadQueryTarget = async (openDialog = true): Promise<void> => {
    const sequence = ++targetSequence
    const id = queryId.value
    targetController?.abort()
    targetController = null
    // A same-id refresh after a mutation keeps the shown period until fresh data replaces it.
    if (openDialog || queryTarget.value?.id !== id) queryTarget.value = null
    targetLoading.value = false
    targetError.value = null
    if (openDialog) closeAction()
    if (!id || !mounted || disposed || !auth.isAuthenticated || !auth.token) return
    const requestToken = auth.token
    const controller = new AbortController()
    targetController = controller
    const isCurrent = () => !disposed && mounted && sequence === targetSequence &&
        queryId.value === id && auth.isAuthenticated && auth.token === requestToken && !controller.signal.aborted
    targetLoading.value = true
    try {
        const transaction = await getExpectedTransaction(id, controller.signal)
        if (!isCurrent()) return
        queryTarget.value = transaction
        if (openDialog && isPending(transaction) && !isDebtLinked(transaction)) openAction(transaction, isIncomeExpense(transaction) ? 'payment' : 'link')
    } catch (error) {
        if (isCurrent()) targetError.value = errorMessage(error, 'expected.errors.retryTarget')
    } finally {
        if (isCurrent()) {
            targetLoading.value = false
            targetController = null
        }
    }
}
const handleCommitted = (payload: CommittedPayload): void => {
    if (!mounted || disposed || !auth.isAuthenticated || !auth.token || selectedTransaction.value?.id !== payload.expectedTransactionId) return
    // Install committed data before notifying readers; the post-flush watcher refreshes after rendering it.
    success.value = payload
    closeAction()
    pendingCommitRefresh = true
    notifyMutation()
}
const handleCanonical = (transaction: ExpectedTransactionViewModel): void => {
    if (!mounted || disposed || !auth.isAuthenticated || !auth.token || selectedTransaction.value?.id !== transaction.id) return
    selectedTransaction.value = transaction
    transactions.value = transactions.value.map(row => row.id === transaction.id ? transaction : row)
    if (queryTarget.value?.id === transaction.id) queryTarget.value = transaction
    void loadTransactions()
}

const clearSessionState = (): void => {
    resettingSession = true
    listSequence += 1
    templateSequence += 1
    targetSequence += 1
    listController?.abort()
    templateController?.abort()
    targetController?.abort()
    listController = null
    templateController = null
    targetController = null
    transactions.value = []
    pagination.value = emptyPagination()
    loading.value = false
    listError.value = null
    listErrorAfterCommit.value = false
    dateRangeError.value = false
    pendingCommitRefresh = false
    templateOptions.value = []
    templatesLoading.value = false
    templatesError.value = null
    success.value = null
    closeAction()
    queryTarget.value = null
    targetLoading.value = false
    targetError.value = null
    filters.value = emptyFilters()
    resettingSession = false
}

watch(filters, () => {
    if (resettingSession || disposed) return
    pagination.value = { ...emptyPagination(), pageSize: pagination.value.pageSize }
    transactions.value = []
    void loadTransactions(1)
}, { deep: true, flush: 'sync' })
watch(queryId, () => {
    if (mounted && !disposed) void loadQueryTarget()
}, { flush: 'post' })
watch(() => [auth.token, auth.isAuthenticated], () => {
    clearSessionState()
    if (mounted && !disposed && auth.isAuthenticated && auth.token) {
        void loadTransactions(1)
        void loadTemplateOptions()
        void loadQueryTarget()
    }
}, { flush: 'sync' })
watch(revision, () => {
    const afterCommit = pendingCommitRefresh
    pendingCommitRefresh = false
    if (mounted && !disposed && auth.isAuthenticated && auth.token) {
        void loadTransactions(pagination.value.pageIndex, afterCommit)
        if (queryId.value) void loadQueryTarget(false)
    }
}, { flush: 'post' })

onMounted(() => {
    mounted = true
    void loadTransactions(1)
    void loadTemplateOptions()
    void loadQueryTarget()
})
onBeforeUnmount(() => {
    disposed = true
    mounted = false
    clearSessionState()
})
</script>

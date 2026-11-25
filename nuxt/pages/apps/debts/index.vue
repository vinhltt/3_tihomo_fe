<template>
    <div class="space-y-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
                <h1 class="text-2xl font-semibold dark:text-white-light">{{ t('debts.title') }}</h1>
                <p class="mt-1 text-gray-500">{{ t('debts.description') }}</p>
            </div>
            <button type="button" class="btn btn-primary" @click="openForm(null)">{{ t('debts.form.createTitle') }}</button>
        </div>

        <section v-if="noticeKey" role="status" class="panel flex items-start justify-between gap-4 border border-success/30 bg-success/10">
            <p class="text-success">{{ t(noticeKey) }}</p>
            <button type="button" class="btn btn-sm btn-outline-success shrink-0" @click="noticeKey = null">{{ t('common.close') }}</button>
        </section>
        <section v-if="actionError" role="alert" class="panel flex items-start justify-between gap-4 border border-danger/20 bg-danger/10">
            <p class="text-danger">{{ t('debts.errors.actionFailed', { error: errorText(actionError) }) }}</p>
            <button type="button" class="btn btn-sm btn-outline-danger shrink-0" @click="actionError = null">{{ t('common.close') }}</button>
        </section>

        <DebtTotalsSummary />
        <DebtFilters v-model="filters" @reset="resetFilters" />
        <DebtTable
            :debts="debts"
            :pagination="pagination"
            :loading="loading"
            :list-error="listError ? errorText(listError) : null"
            :authenticated="auth.isAuthenticated"
            :action-id="actionId"
            @edit="openForm"
            @close="requestClose"
            @delete="requestDelete"
            @retry="retry"
            @change-page="loadDebts"
            @reload="loadDebts()"
        />

        <DebtFormModal v-if="formOpen" :debt="editing" @close="closeForm" @saved="handleSaved" />
    </div>
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useHead } from '#imports'
import DebtFilters from '~/components/apps/debts/DebtFilters.vue'
import DebtFormModal from '~/components/apps/debts/DebtFormModal.vue'
import DebtTable from '~/components/apps/debts/DebtTable.vue'
import DebtTotalsSummary from '~/components/apps/debts/DebtTotalsSummary.vue'
import { useDebtActions, useDebts } from '~/composables/useDebts'
import { useExpectedTransactions } from '~/composables/useExpectedTransactions'
import { useAuthStore } from '~/stores/auth'
import type { Pagination } from '~/types/api'
import type { Debt, DebtDialog, DebtDisplayError, DebtFilterForm } from '~/types/debt'
import { errorMessage } from '~/utils/expected-transaction-formatters'

const auth = useAuthStore()
const { getDebts } = useDebts()
const { revision } = useExpectedTransactions()
const { t } = useI18n()

let dialogOpen = false
// User data only goes through titleText and text, which are not rendered as HTML.
const confirmDialog = async (dialog: DebtDialog): Promise<boolean> => {
    dialogOpen = true
    const answer = await Swal.fire({
        titleText: t(dialog.titleKey, dialog.titleParams),
        text: t(dialog.textKey, dialog.textParams),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: t(dialog.confirmKey),
        cancelButtonText: t('common.back')
    })
    dialogOpen = false
    return answer.isConfirmed
}
const { actionId, actionError, noticeKey, requestClose, requestDelete, retry } = useDebtActions(confirmDialog)

const emptyPagination = (): Pagination => ({ pageIndex: 1, pageSize: 10, totalRow: 0, pageCount: 0 })
const emptyFilters = (): DebtFilterForm => ({ direction: '', status: '' })
const filters = ref<DebtFilterForm>(emptyFilters())
const debts = ref<Debt[]>([])
const pagination = ref<Pagination>(emptyPagination())
// The server and the first client render both show the loading state, never an empty list that was not read yet.
const loading = ref(true)
const listError = ref<DebtDisplayError | null>(null)
const formOpen = ref(false)
const editing = ref<Debt | null>(null)
let mounted = false
let resettingSession = false
let listSequence = 0
let listController: AbortController | null = null

// A frontend message carries messageKey; a backend message is shown verbatim. Resolved at render, so it follows a locale switch.
const errorText = (error: DebtDisplayError): string => (error.messageKey ? t(error.messageKey, error.messageParams ?? {}) : error.message)

useHead({ title: computed(() => t('debts.title')) })

const invalidateList = (): void => {
    listSequence += 1
    listController?.abort()
    listController = null
    loading.value = false
}

const loadDebts = async (page = pagination.value.pageIndex): Promise<void> => {
    invalidateList()
    if (!mounted || !auth.isAuthenticated || !auth.token) return
    const sequence = listSequence
    const requestToken = auth.token
    const controller = new AbortController()
    listController = controller
    const isCurrent = () => mounted && sequence === listSequence && auth.isAuthenticated && auth.token === requestToken && !controller.signal.aborted
    const pageCount = pagination.value.pageCount
    const safePage = pageCount > 0 ? Math.min(Math.max(page, 1), pageCount) : 1
    listError.value = null
    loading.value = true
    try {
        const response = await getDebts(filters.value, safePage, pagination.value.pageSize, controller.signal)
        if (!isCurrent()) return
        debts.value = response.data
        pagination.value = response.pagination
    } catch (error) {
        if (isCurrent()) listError.value = errorMessage(error, 'common.errors.loadFailed')
    } finally {
        if (isCurrent()) {
            loading.value = false
            listController = null
        }
    }
}

const resetFilters = (): void => { filters.value = emptyFilters() }
const openForm = (debt: Debt | null): void => {
    if (!auth.isAuthenticated || !auth.token) return
    editing.value = debt
    formOpen.value = true
}
const closeForm = (): void => {
    formOpen.value = false
    editing.value = null
}
const handleSaved = (saved: Debt): void => {
    actionError.value = null
    if (editing.value) {
        noticeKey.value = 'debts.notice.updated'
    } else {
        noticeKey.value = saved.status === 'Provisioning' ? 'debts.notice.provisioning' : 'debts.notice.created'
        // The newest debt is on the first page.
        pagination.value.pageIndex = 1
        void loadDebts()
    }
    closeForm()
}

const clearSessionState = (): void => {
    resettingSession = true
    invalidateList()
    // A dialog of the old session must not stay open; closing answers it as not confirmed.
    if (dialogOpen) Swal.close()
    debts.value = []
    pagination.value = emptyPagination()
    listError.value = null
    closeForm()
    filters.value = emptyFilters()
    resettingSession = false
}

watch(filters, () => {
    if (resettingSession) return
    pagination.value = { ...emptyPagination(), pageSize: pagination.value.pageSize }
    debts.value = []
    void loadDebts(1)
}, { deep: true, flush: 'sync' })
watch(() => [auth.token, auth.isAuthenticated], () => {
    clearSessionState()
    void loadDebts(1)
}, { flush: 'sync' })
watch(revision, () => void loadDebts(), { flush: 'post' })

onMounted(() => {
    mounted = true
    void loadDebts(1)
})
onBeforeUnmount(() => {
    mounted = false
    clearSessionState()
})
</script>

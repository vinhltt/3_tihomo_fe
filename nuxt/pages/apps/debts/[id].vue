<template>
    <div class="space-y-6">
        <NuxtLink to="/apps/debts" class="inline-block text-primary hover:underline">{{ t('debts.detail.back') }}</NuxtLink>

        <section
            v-if="noticeKey"
            :role="waiting ? 'alert' : 'status'"
            class="panel flex items-start justify-between gap-4 border"
            :class="waiting ? 'border-warning/30 bg-warning/10' : 'border-success/30 bg-success/10'"
        >
            <p :class="waiting ? 'text-warning' : 'text-success'">{{ t(noticeKey) }}</p>
            <button type="button" class="btn btn-sm shrink-0" :class="waiting ? 'btn-outline-warning' : 'btn-outline-success'" @click="noticeKey = null">{{ t('common.close') }}</button>
        </section>
        <section v-if="actionError" role="alert" class="panel flex items-start justify-between gap-4 border border-danger/20 bg-danger/10">
            <p class="text-danger">{{ t('debts.errors.actionFailed', { error: errorText(actionError) }) }}</p>
            <button type="button" class="btn btn-sm btn-outline-danger shrink-0" @click="actionError = null">{{ t('common.close') }}</button>
        </section>

        <p v-if="loading && (!debt || loadError)" role="status" class="panel py-12 text-center text-gray-500">{{ t('debts.detail.loading') }}</p>
        <section v-else-if="loadError" role="alert" class="panel border border-danger/20 bg-danger/10 text-danger">
            <p>{{ notFound ? t('debts.detail.notFound') : t('debts.detail.loadFailed', { error: errorText(loadError) }) }}</p>
            <button type="button" class="btn btn-sm btn-outline-primary mt-3" @click="loadDebt">{{ t('common.retry') }}</button>
        </section>
        <p v-else-if="!auth.isAuthenticated" class="panel py-12 text-center text-gray-500">{{ t('debts.list.signInRequired') }}</p>
        <template v-else-if="debt">
            <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0">
                    <h1 class="break-words text-2xl font-semibold dark:text-white-light">{{ debt.name }}</h1>
                    <span class="badge mt-2 inline-block" :class="debtStatusClass(debt.status)">{{ labelText(DEBT_STATUS_KEYS, debt.status) }}</span>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button v-if="provisioning && !isDebtBusy(debt)" type="button" class="btn btn-sm btn-outline-primary" :disabled="!!actionId" @click="retry(debt)">{{ t('common.retry') }}</button>
                    <template v-if="!provisioning">
                        <button v-if="hasPaymentActions(debt)" type="button" class="btn btn-sm btn-primary" :disabled="!!actionId || !canRecordPayment(debt)" @click="paying = true">
                            {{ debt.direction === 'Borrow' ? t('debts.payment.recordBorrow') : t('debts.payment.recordLend') }}
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-primary" :disabled="!!actionId || !canEditDebt(debt)" @click="editing = true">{{ t('common.edit') }}</button>
                        <button type="button" class="btn btn-sm btn-outline-warning" :disabled="!!actionId || !canCloseDebt(debt)" @click="requestClose(debt)">{{ t('debts.close.action') }}</button>
                    </template>
                    <button type="button" class="btn btn-sm btn-outline-danger" :disabled="!!actionId || !canDeleteDebt(debt)" @click="requestDelete(debt)">
                        {{ provisioning ? t('common.cancel') : t('common.delete') }}
                    </button>
                </div>
            </div>

            <DebtPendingSyncAlert :debt="debt" detailed :disabled="!!actionId" @resync="retry(debt)" />

            <dl class="panel grid gap-4 sm:grid-cols-2 lg:grid-cols-3" :aria-busy="loading">
                <div v-for="[key, value] in facts" :key="key">
                    <dt class="text-sm text-gray-500">{{ t(key) }}</dt>
                    <dd class="mt-1 whitespace-pre-line break-words font-semibold">{{ value }}</dd>
                </div>
            </dl>

            <DebtPaymentHistory
                :debt="debt"
                :payments="payments"
                :disabled="!!actionId"
                @resync="payment => debt && retryPayment(debt, payment)"
                @cancel="payment => debt && requestCancelPayment(debt, payment)"
            />
        </template>

        <!-- Outside the states above: a reload that fails must not take an open dialog and its attempt away. -->
        <DebtFormModal v-if="editing && debt" :debt="debt" @close="editing = false" @saved="handleSaved" />
        <DebtRecordPaymentModal v-if="paying && debt" :debt="debt" @close="paying = false" @saved="handlePaid" />
        <DebtConfirmDialog ref="confirmDialog" />
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { navigateTo, useHead, useRoute } from '#imports'
import DebtConfirmDialog from '~/components/apps/debts/DebtConfirmDialog.vue'
import DebtFormModal from '~/components/apps/debts/DebtFormModal.vue'
import DebtPaymentHistory from '~/components/apps/debts/DebtPaymentHistory.vue'
import DebtPendingSyncAlert from '~/components/apps/debts/DebtPendingSyncAlert.vue'
import DebtRecordPaymentModal from '~/components/apps/debts/DebtRecordPaymentModal.vue'
import { useDebtActions, useDebts } from '~/composables/useDebts'
import { useExpectedTransactions } from '~/composables/useExpectedTransactions'
import { useAuthStore } from '~/stores/auth'
import type { ApiError } from '~/types/api'
import type { Debt, DebtDisplayError, DebtPayment } from '~/types/debt'
import {
    DEBT_DIRECTION_KEYS,
    DEBT_STATUS_KEYS,
    DEBT_TYPE_KEYS,
    canCloseDebt,
    canDeleteDebt,
    canEditDebt,
    canRecordPayment,
    debtLabel,
    debtStatusClass,
    formatDebtAmount,
    hasPaymentActions,
    isDebtBusy
} from '~/utils/debt-formatters'
import { formatDate, formatNumber } from '~/utils/display-format'
import { errorMessage } from '~/utils/expected-transaction-formatters'

const auth = useAuthStore()
const { getDebt, getPayments } = useDebts()
const { revision } = useExpectedTransactions()
const { t } = useI18n()

const confirmDialog = ref<InstanceType<typeof DebtConfirmDialog> | null>(null)
const { actionId, actionError, noticeKey, requestClose, requestDelete, retry, requestCancelPayment, retryPayment } = useDebtActions(
    dialog => confirmDialog.value?.confirm(dialog) ?? Promise.resolve(false)
)

// The page is mounted again for another id.
const debtId = String(useRoute().params.id)
const debt = ref<Debt | null>(null)
const payments = ref<DebtPayment[]>([])
// The server and the first client render both show the loading state.
const loading = ref(true)
const loadError = ref<DebtDisplayError | null>(null)
const notFound = ref(false)
const editing = ref(false)
const paying = ref(false)
let mounted = false
let sequence = 0
let controller: AbortController | null = null

// A frontend message carries messageKey; a backend message is shown verbatim. Resolved at render, so it follows a locale switch.
const errorText = (error: DebtDisplayError): string => (error.messageKey ? t(error.messageKey, error.messageParams ?? {}) : error.message)
const labelText = (keys: Record<string, string>, value: string): string => {
    const label = debtLabel(keys, value)
    return 'raw' in label ? label.raw : t(label.key)
}
const provisioning = computed(() => debt.value?.status === 'Provisioning')
// A payment that waits to be synced is not a success yet.
const waiting = computed(() => noticeKey.value === 'debts.notice.paymentPending')
const facts = computed((): Array<[string, string]> => {
    const value = debt.value
    if (!value) return []
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

useHead({ title: computed(() => t('debts.detail.title')) })

const invalidate = (): void => {
    sequence += 1
    controller?.abort()
    controller = null
    loading.value = false
}

const loadDebt = async (): Promise<void> => {
    invalidate()
    if (!mounted || !auth.isAuthenticated || !auth.token) return
    const requestSequence = sequence
    const requestToken = auth.token
    const requestController = new AbortController()
    controller = requestController
    const isCurrent = () => mounted && requestSequence === sequence && auth.token === requestToken && !requestController.signal.aborted
    loading.value = true
    try {
        const [freshDebt, freshPayments] = await Promise.all([getDebt(debtId, requestController.signal), getPayments(debtId, requestController.signal)])
        if (!isCurrent()) return
        debt.value = freshDebt
        payments.value = freshPayments
        loadError.value = null
    } catch (error) {
        // A failed read never leaves a stale debt next to the error.
        if (!isCurrent()) return
        notFound.value = (error as Partial<ApiError> | null)?.statusCode === 404
        loadError.value = errorMessage(error, 'common.errors.loadFailed')
    } finally {
        if (isCurrent()) {
            loading.value = false
            controller = null
        }
    }
}

const handleSaved = (): void => {
    editing.value = false
    actionError.value = null
    noticeKey.value = 'debts.notice.updated'
}
const handlePaid = (payment: DebtPayment): void => {
    paying.value = false
    actionError.value = null
    noticeKey.value = payment.status === 'Pending' ? 'debts.notice.paymentPending' : 'debts.notice.paymentSaved'
}

const clearSessionState = (): void => {
    invalidate()
    debt.value = null
    payments.value = []
    loadError.value = null
    editing.value = false
    paying.value = false
}

watch(noticeKey, key => {
    if (key !== 'debts.notice.deleted') return
    // The deletion also asks for a reload, which must not show a missing debt before the list opens.
    mounted = false
    clearSessionState()
    loading.value = true
    void navigateTo('/apps/debts')
}, { flush: 'sync' })
watch(() => [auth.token, auth.isAuthenticated], () => {
    clearSessionState()
    void loadDebt()
}, { flush: 'sync' })
watch(revision, () => void loadDebt(), { flush: 'post' })

onMounted(() => {
    mounted = true
    void loadDebt()
})
onBeforeUnmount(() => {
    mounted = false
    clearSessionState()
})
</script>

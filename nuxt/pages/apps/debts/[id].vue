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
            <DebtDetailHeader
                :debt="debt"
                :loading="loading"
                :disabled="!!actionId"
                @retry="retry(debt)"
                @pay="openDialog('pay')"
                @edit="openDialog('edit')"
                @close="requestClose(debt)"
                @delete="requestDelete(debt)"
            />

            <DebtSchedulePanel :debt="debt" :disabled="!!actionId" @open="openDialog" />

            <DebtPaymentHistory
                :debt="debt"
                :payments="payments"
                :disabled="!!actionId"
                @resync="payment => debt && retryPayment(debt, payment)"
                @cancel="payment => debt && requestCancelPayment(debt, payment)"
            />
        </template>

        <!-- Outside the states above: a reload that fails must not take an open dialog and its attempt away. -->
        <template v-if="debt">
            <DebtFormModal v-if="dialog === 'edit'" :debt="debt" @close="dialog = null" @saved="finish('debts.notice.updated')" />
            <DebtRecordPaymentModal v-if="dialog === 'pay'" :debt="debt" :installment="installment" @close="dialog = null" @saved="handlePaid" />
            <DebtScheduleSetupModal v-if="dialog === 'createSchedule'" :debt="debt" @close="dialog = null" @saved="finish('debts.notice.scheduleCreated')" />
            <DebtRecalculateModal v-if="dialog === 'recalculate'" :debt="debt" @close="dialog = null" @saved="finish('debts.notice.scheduleRecalculated')" />
            <DebtInstallmentAdjustModal
                v-if="dialog === 'adjust' && installment"
                :debt="debt"
                :installment="installment"
                @close="dialog = null"
                @saved="finish('debts.notice.installmentAdjusted')"
            />
        </template>
        <DebtConfirmDialog ref="confirmDialog" />
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { navigateTo, useHead, useRoute } from '#imports'
import DebtConfirmDialog from '~/components/apps/debts/DebtConfirmDialog.vue'
import DebtDetailHeader from '~/components/apps/debts/DebtDetailHeader.vue'
import DebtFormModal from '~/components/apps/debts/DebtFormModal.vue'
import DebtInstallmentAdjustModal from '~/components/apps/debts/DebtInstallmentAdjustModal.vue'
import DebtPaymentHistory from '~/components/apps/debts/DebtPaymentHistory.vue'
import DebtRecalculateModal from '~/components/apps/debts/DebtRecalculateModal.vue'
import DebtRecordPaymentModal from '~/components/apps/debts/DebtRecordPaymentModal.vue'
import DebtSchedulePanel from '~/components/apps/debts/DebtSchedulePanel.vue'
import DebtScheduleSetupModal from '~/components/apps/debts/DebtScheduleSetupModal.vue'
import { useDebtActions } from '~/composables/useDebtActions'
import { useDebts } from '~/composables/useDebts'
import { useExpectedTransactions } from '~/composables/useExpectedTransactions'
import { useAuthStore } from '~/stores/auth'
import type { ApiError } from '~/types/api'
import type { Debt, DebtDetailDialog, DebtDisplayError, DebtInstallment, DebtPayment } from '~/types/debt'
import { errorMessage } from '~/utils/expected-transaction-formatters'

const auth = useAuthStore()
const { getDebt, getPayments } = useDebts()
const { revision } = useExpectedTransactions()
const { t } = useI18n()

const confirmDialog = ref<InstanceType<typeof DebtConfirmDialog> | null>(null)
const { actionId, actionError, noticeKey, requestClose, requestDelete, retry, requestCancelPayment, retryPayment } = useDebtActions(
    request => confirmDialog.value?.confirm(request) ?? Promise.resolve(false)
)

// The page is mounted again for another id.
const debtId = String(useRoute().params.id)
const debt = ref<Debt | null>(null)
const payments = ref<DebtPayment[]>([])
// The server and the first client render both show the loading state.
const loading = ref(true)
const loadError = ref<DebtDisplayError | null>(null)
const notFound = ref(false)
const dialog = ref<DebtDetailDialog | null>(null)
// The installment the dialog was opened for, or null for a dialog of the whole debt.
const installment = shallowRef<DebtInstallment | null>(null)
let mounted = false
let sequence = 0
let controller: AbortController | null = null

// A frontend message carries messageKey; a backend message is shown verbatim. Resolved at render, so it follows a locale switch.
const errorText = (error: DebtDisplayError): string => (error.messageKey ? t(error.messageKey, error.messageParams ?? {}) : error.message)
// A payment that waits to be synced is not a success yet.
const waiting = computed(() => noticeKey.value === 'debts.notice.paymentPending')

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

const openDialog = (name: DebtDetailDialog, target: DebtInstallment | null = null): void => {
    installment.value = target
    dialog.value = name
}
const finish = (key: string): void => {
    dialog.value = null
    actionError.value = null
    noticeKey.value = key
}
const handlePaid = (payment: DebtPayment): void => finish(payment.status === 'Pending' ? 'debts.notice.paymentPending' : 'debts.notice.paymentSaved')

const clearSessionState = (): void => {
    invalidate()
    debt.value = null
    payments.value = []
    loadError.value = null
    dialog.value = null
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

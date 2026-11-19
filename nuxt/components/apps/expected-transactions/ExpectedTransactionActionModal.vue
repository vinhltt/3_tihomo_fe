<template>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="closeModal">
        <section
            ref="dialog"
            role="dialog"
            aria-modal="true"
            :aria-label="title"
            tabindex="-1"
            class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl outline-none dark:bg-[#0e1726]"
            @keydown="handleDialogKeydown"
        >
            <div class="flex items-center justify-between gap-4 border-b border-gray-200 p-5 dark:border-gray-700">
                <h2 class="text-lg font-semibold">{{ title }}</h2>
                <button type="button" class="btn btn-sm btn-outline-secondary" @click="closeModal">{{ saving ? t('expected.modal.closeWhileSaving') : t('common.close') }}</button>
            </div>

            <form v-if="currentTransaction" class="space-y-5 p-5" @submit.prevent="submitAction">
                <ExpectedTransactionSummary :transaction="currentTransaction" />

                <div v-if="saveError" role="alert" class="rounded-lg border border-danger/20 bg-danger/10 p-3 text-danger">
                    <p>{{ t('expected.modal.saveFailed', { error: errorText(saveError) }) }}</p>
                    <ul v-if="validationErrors.length" class="mt-2 list-disc pl-5">
                        <li v-for="(message, index) in validationErrors" :key="index">{{ message }}</li>
                    </ul>
                    <p v-if="mode === 'payment'" class="mt-2 text-sm">{{ t('expected.modal.paymentNoAutoRetry') }}</p>
                </div>
                <div v-if="paymentOutcomeUnknown" class="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                    <p>{{ t('expected.modal.paymentUnknown') }}</p>
                    <p class="mt-1">{{ t('expected.modal.paymentUnknownHint') }}</p>
                    <button v-if="!canonicalError" type="button" class="btn btn-sm btn-outline-primary mt-2" :disabled="canonicalLoading" @click="reloadCanonical">{{ t('expected.modal.reloadState') }}</button>
                </div>
                <div v-if="conflictBlocked || canonicalReadComplete" class="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                    <p v-if="canonicalLoading" role="status">
                        {{ paymentOutcomeUnknown ? t('expected.modal.reloadingLocked') : t('expected.modal.reloadingChanged') }}
                    </p>
                    <template v-else-if="canonicalError">
                        <p role="alert">{{ t('expected.modal.reloadFailed', { error: errorText(canonicalError) }) }}</p>
                        <p class="mt-1">{{ t('expected.modal.stillLocked') }}</p>
                        <button type="button" class="btn btn-sm btn-outline-primary mt-2" @click="reloadCanonical">{{ t('expected.modal.retryReloadState') }}</button>
                    </template>
                    <p v-else-if="canonicalReadComplete">{{ t('expected.modal.reloaded') }}</p>
                    <p v-else>{{ t('expected.modal.changed') }}</p>
                </div>
                <p v-if="!actionAllowed" role="alert" class="rounded-lg bg-warning/10 p-3 text-warning">
                    {{ t('expected.modal.notAllowed') }}
                </p>

                <ExpectedTransactionPaymentFields
                    v-if="mode === 'payment'"
                    v-model="selectedAccountId"
                    :transaction="currentTransaction"
                    :accounts="accounts"
                    :accounts-loading="accountsLoading"
                    :account-error="accountError"
                    :payment-account-available="paymentAccountAvailable"
                    :select-disabled="accountsLoading || !!accountError || saving || conflictBlocked || paymentOutcomeUnknown"
                    :saving="saving"
                    @retry="loadAccounts"
                />
                <ExpectedTransactionLinkPicker
                    v-else-if="mode === 'link' && readerSession !== null"
                    :session-key="readerSession"
                    :saving="saving"
                    :conflict-blocked="conflictBlocked"
                    :selected="selectedActual"
                    @selected="selectActual"
                    @blocked="setActualBlocked"
                />

                <template v-else-if="mode === 'adjust'">
                    <div>
                        <label for="expected-new-amount" class="mb-1 block text-sm font-medium">{{ t('expected.modal.newAmount') }} *</label>
                        <input id="expected-new-amount" v-model="newAmount" type="number" min="0" step="any" class="form-input" :disabled="saving || conflictBlocked" required />
                        <p class="mt-1 text-sm text-gray-500">{{ t('expected.modal.newAmountHint') }}</p>
                    </div>
                </template>

                <div v-if="mode === 'cancel' || mode === 'adjust'">
                    <label for="expected-action-reason" class="mb-1 block text-sm font-medium">{{ mode === 'cancel' ? t('expected.modal.cancelReason') : t('expected.modal.adjustReason') }} *</label>
                    <textarea id="expected-action-reason" v-model="reason" rows="3" class="form-textarea" :disabled="saving || conflictBlocked" required></textarea>
                    <p class="mt-1 text-sm text-gray-500">{{ t('expected.modal.reasonHint') }}</p>
                </div>
                <p v-if="mode === 'cancel'" class="text-sm text-gray-500">{{ t('expected.modal.cancelHint') }}</p>
                <p v-if="saving" role="status" class="rounded-lg bg-warning/10 p-3 text-sm text-warning">
                    {{ t('expected.modal.savingNotice') }}
                </p>
                <div class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <button type="button" class="btn btn-outline-secondary" @click="closeModal">{{ saving ? t('expected.modal.closeWhileSaving') : t('common.close') }}</button>
                    <button type="submit" class="btn" :class="mode === 'cancel' ? 'btn-danger' : 'btn-primary'" :disabled="!canSubmit">{{ saving ? t('transactions.form.processing') : title }}</button>
                </div>
            </form>
            <div v-else class="p-5 text-gray-500">{{ t('expected.modal.sessionChanged') }}</div>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ExpectedTransactionLinkPicker from '~/components/apps/expected-transactions/ExpectedTransactionLinkPicker.vue'
import ExpectedTransactionPaymentFields from '~/components/apps/expected-transactions/ExpectedTransactionPaymentFields.vue'
import ExpectedTransactionSummary from '~/components/apps/expected-transactions/ExpectedTransactionSummary.vue'
import { useAccountsSimple } from '~/composables/useAccountsSimple'
import { useExpectedTransactions } from '~/composables/useExpectedTransactions'
import { useAuthStore } from '~/stores/auth'
import type { ApiError } from '~/types/api'
import { ExpectedTransactionDisplayStatus, ExpectedTransactionStatus, RecurringTransactionType } from '~/types/recurring-transaction'
import type { ActionMode, CommittedPayload, ExpectedTransactionViewModel, RecordPaymentResult } from '~/types/recurring-transaction'
import type { TransactionViewModel } from '~/types/transaction'
import { errorMessage } from '~/utils/expected-transaction-formatters'

const props = defineProps<{ transaction: ExpectedTransactionViewModel; mode: ActionMode }>()
const emit = defineEmits<{
    close: []
    committed: [payload: CommittedPayload]
    canonical: [transaction: ExpectedTransactionViewModel]
}>()

const auth = useAuthStore()
const { getExpectedTransaction, recordPayment, confirm, cancel, adjust, notifyMutation } = useExpectedTransactions()
const { accounts, isLoading: helperAccountsLoading, error: accountError, getAccounts, clearAccounts } = useAccountsSimple()
const dialog = ref<HTMLElement | null>(null)
const currentTransaction = ref<ExpectedTransactionViewModel | null>(props.transaction)
const selectedAccountId = ref('')
const newAmount = ref<number | string>(props.transaction.expectedAmount)
const reason = ref('')
const saving = ref(false)
const committed = ref(false)
const saveError = ref<Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null>(null)
const validationErrors = ref<string[]>([])
const conflictBlocked = ref(false)
// Sticky for this mount: a network/5xx payment may still have committed, so a canonical read never unlocks it.
const paymentOutcomeUnknown = ref(false)
const canonicalLoading = ref(false)
const canonicalError = ref<Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null>(null)
const canonicalReadComplete = ref(false)
const accountReadLoading = ref(props.mode === 'payment')
const selectedActual = ref<TransactionViewModel | null>(null)
// Mirrors the picker's loading/error state; true until its first read settles, as the picker starts loading.
const actualBlocked = ref(props.mode === 'link')
// Session marker for the picker (never the token); null unmounts it, so its reads abort with the session.
const readerSession = ref<number | null>(null)
const mounted = ref(false)
let disposed = false
let closed = false
const openingSessionToken = auth.token
let focusSessionInvalidated = false
let sessionToken = auth.token
let readerSessionSequence = 0
let mutationSequence = 0
let accountSequence = 0
let canonicalSequence = 0
let accountController: AbortController | null = null
let canonicalController: AbortController | null = null
let previousFocus: HTMLElement | null = null

const { t } = useI18n()

// A frontend message carries messageKey; a backend message is shown verbatim.
const errorText = (error: Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null): string =>
    error?.messageKey ? t(error.messageKey, error.messageParams ?? {}) : error?.message || t('common.errors.unknown')
const isCurrentSession = (): boolean => mounted.value && !disposed && !closed &&
    !!sessionToken && auth.isAuthenticated && auth.token === sessionToken
const title = computed(() => {
    switch (props.mode) {
        case 'payment': return t('expected.actions.payment')
        case 'link': return t('expected.actions.link')
        case 'cancel': return t('expected.actions.cancel')
        case 'adjust': return t('expected.actions.adjust')
    }
})
const accountsLoading = computed(() => accountReadLoading.value || helperAccountsLoading.value)
const paymentAccountId = computed(() => currentTransaction.value?.accountId || selectedAccountId.value)
const paymentAccountAvailable = computed(() => !!paymentAccountId.value && accounts.value.some(account => account.id === paymentAccountId.value))
const actionAllowed = computed(() => {
    const transaction = currentTransaction.value
    if (!transaction || transaction.status !== ExpectedTransactionStatus.Pending ||
        (transaction.displayStatus !== ExpectedTransactionDisplayStatus.Pending && transaction.displayStatus !== ExpectedTransactionDisplayStatus.Overdue)) return false
    const incomeExpense = transaction.transactionType === RecurringTransactionType.Income || transaction.transactionType === RecurringTransactionType.Expense
    if (props.mode === 'payment' || props.mode === 'adjust') return incomeExpense
    return incomeExpense || transaction.transactionType === RecurringTransactionType.Transfer
})
const canSubmit = computed(() => {
    if (!isCurrentSession() || !actionAllowed.value || saving.value || committed.value || conflictBlocked.value || canonicalLoading.value || paymentOutcomeUnknown.value) return false
    switch (props.mode) {
        case 'payment': return !accountsLoading.value && !accountError.value && paymentAccountAvailable.value &&
            Number.isFinite(currentTransaction.value?.expectedAmount) && (currentTransaction.value?.expectedAmount ?? 0) > 0
        case 'link': return !actualBlocked.value && !!selectedActual.value
        case 'cancel': return !!reason.value.trim()
        case 'adjust': return !!reason.value.trim() && Number.isFinite(Number(newAmount.value)) && Number(newAmount.value) > 0
    }
})
// useApi maps network failures to 0 and unclassified failures to 500; neither proves the command was rejected.
const isUnknownOutcome = (error: Partial<ApiError> | null): boolean => {
    const statusCode = error?.statusCode
    return typeof statusCode !== 'number' || statusCode === 0 || statusCode >= 500
}
// Picker events only count while this modal still owns the session.
const selectActual = (actual: TransactionViewModel | null): void => {
    if (isCurrentSession()) selectedActual.value = actual
}
const setActualBlocked = (blocked: boolean): void => {
    if (isCurrentSession()) actualBlocked.value = blocked
}

const loadAccounts = async (): Promise<void> => {
    const sequence = ++accountSequence
    accountController?.abort()
    accountController = null
    if (!isCurrentSession() || props.mode !== 'payment') return
    const requestToken = sessionToken
    const controller = new AbortController()
    accountController = controller
    const isCurrent = () => isCurrentSession() && sessionToken === requestToken &&
        sequence === accountSequence && !controller.signal.aborted
    accountReadLoading.value = true
    try {
        // The helper resolves Promise<void>; failures are exposed through its error ref.
        await getAccounts(controller.signal)
    } finally {
        if (isCurrent()) {
            accountReadLoading.value = false
            accountController = null
        }
    }
}

const reloadCanonical = async (): Promise<void> => {
    if (!isCurrentSession() || !currentTransaction.value || saving.value) return
    const sequence = ++canonicalSequence
    canonicalController?.abort()
    const requestToken = sessionToken
    const expectedTransactionId = currentTransaction.value.id
    const controller = new AbortController()
    canonicalController = controller
    const isCurrent = () => isCurrentSession() && sessionToken === requestToken &&
        sequence === canonicalSequence && !controller.signal.aborted && currentTransaction.value?.id === expectedTransactionId
    conflictBlocked.value = true
    canonicalLoading.value = true
    canonicalError.value = null
    canonicalReadComplete.value = false
    try {
        const transaction = await getExpectedTransaction(expectedTransactionId, controller.signal)
        if (!isCurrent()) return
        currentTransaction.value = transaction
        canonicalReadComplete.value = true
        conflictBlocked.value = false
        emit('canonical', transaction)
    } catch (error) {
        if (isCurrent()) canonicalError.value = errorMessage(error, 'expected.errors.retryState')
    } finally {
        if (isCurrent()) {
            canonicalLoading.value = false
            canonicalController = null
        }
    }
}

const submitAction = async (): Promise<void> => {
    const transaction = currentTransaction.value
    if (!transaction || !canSubmit.value) return
    const sequence = ++mutationSequence
    const requestToken = sessionToken
    const mode = props.mode
    const isCurrent = () => isCurrentSession() && sessionToken === requestToken &&
        sequence === mutationSequence && currentTransaction.value?.id === transaction.id
    // isCurrentSession is always false after close; refresh rights only need the submitting auth session.
    const sameSession = () => !!requestToken && auth.isAuthenticated && auth.token === requestToken
    saving.value = true
    saveError.value = null
    validationErrors.value = []
    canonicalReadComplete.value = false
    let payment: RecordPaymentResult | undefined
    let reloadAfterConflict = false
    let succeeded = false
    try {
        switch (mode) {
            case 'payment':
                payment = await recordPayment(transaction.id, transaction.accountId ? {} : { accountId: selectedAccountId.value })
                break
            case 'link':
                await confirm(transaction.id, selectedActual.value!.id)
                break
            case 'cancel':
                await cancel(transaction.id, reason.value.trim())
                break
            case 'adjust':
                await adjust(transaction.id, Number(newAmount.value), reason.value.trim())
                break
        }
        succeeded = true
    } catch (error) {
        if (!isCurrent()) return
        const apiError = error as Partial<ApiError> | null
        saveError.value = errorMessage(error, 'expected.errors.checkAndRetry')
        validationErrors.value = Object.values(apiError?.errors || {}).flat()
        if (apiError?.statusCode === 409) {
            conflictBlocked.value = true
            reloadAfterConflict = true
        }
        if (mode === 'payment' && isUnknownOutcome(apiError)) paymentOutcomeUnknown.value = true
    } finally {
        if (isCurrent()) saving.value = false
    }
    if (!isCurrent()) {
        // Closing is not a rollback: a commit landing after close still refreshes readers, but only for the same session.
        // The modal state is gone and the parent drops emits from an unmounted child, so notify the shared revision directly.
        if (succeeded && sameSession()) notifyMutation()
        return
    }
    if (saveError.value) {
        if (reloadAfterConflict) void reloadCanonical()
        return
    }
    committed.value = true
    const payload: CommittedPayload = { mode, expectedTransactionId: transaction.id }
    if (payment) payload.payment = payment
    // Emitting is outside the mutation catch: reader refresh failures cannot turn a commit into a failure.
    emit('committed', payload)
}

const clearModalState = (): void => {
    mutationSequence += 1
    accountSequence += 1
    canonicalSequence += 1
    accountController?.abort()
    canonicalController?.abort()
    accountController = null
    canonicalController = null
    // Unmounting the picker aborts its read and drops any late result.
    readerSession.value = null
    clearAccounts()
    currentTransaction.value = null
    selectedAccountId.value = ''
    newAmount.value = ''
    reason.value = ''
    selectedActual.value = null
    actualBlocked.value = false
    accountReadLoading.value = false
    saving.value = false
    committed.value = false
    saveError.value = null
    validationErrors.value = []
    conflictBlocked.value = false
    paymentOutcomeUnknown.value = false
    canonicalLoading.value = false
    canonicalError.value = null
    canonicalReadComplete.value = false
    sessionToken = null
}
const closeModal = (): void => {
    closed = true
    // Only reads are aborted. A pending command may still commit on the server.
    clearModalState()
    emit('close')
}
const handleDialogKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
        event.preventDefault()
        closeModal()
        return
    }
    if (event.key !== 'Tab' || !dialog.value) return
    const controls = Array.from(dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'))
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (!first || !last) return
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) {
        event.preventDefault()
        last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.value)) {
        event.preventDefault()
        first.focus()
    }
}

watch(() => props.transaction, transaction => {
    if (isCurrentSession()) currentTransaction.value = transaction
}, { flush: 'sync' })
watch(() => [auth.token, auth.isAuthenticated], () => {
    focusSessionInvalidated = true
    clearModalState()
}, { flush: 'sync' })

onMounted(() => {
    mounted.value = true
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    void nextTick(() => { if (isCurrentSession()) dialog.value?.focus() })
    if (props.mode === 'payment') void loadAccounts()
    if (props.mode === 'link' && isCurrentSession()) readerSession.value = ++readerSessionSequence
})
onBeforeUnmount(() => {
    // Focus ownership survives ordinary dismissal, but never an auth transition.
    const restoreFocus = !focusSessionInvalidated && !!openingSessionToken &&
        auth.isAuthenticated && auth.token === openingSessionToken
    disposed = true
    mounted.value = false
    clearModalState()
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus()
})
</script>

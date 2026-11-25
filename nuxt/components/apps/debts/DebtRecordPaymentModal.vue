<template>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="closeModal">
        <section
            ref="dialog"
            role="dialog"
            aria-modal="true"
            :aria-label="heading"
            tabindex="-1"
            class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl outline-none dark:bg-[#0e1726]"
        >
            <div class="flex items-center justify-between gap-4 border-b border-gray-200 p-5 dark:border-gray-700">
                <h2 class="text-lg font-semibold">{{ heading }}</h2>
                <button type="button" class="btn btn-sm btn-outline-secondary" @click="closeModal">{{ closeLabel }}</button>
            </div>

            <form class="space-y-5 p-5" novalidate @submit.prevent="submit">
                <div v-if="errorText" role="alert" class="rounded-lg border border-danger/20 bg-danger/10 p-3 text-danger">
                    <p>{{ errorText }}</p>
                    <p v-if="locked" class="mt-2 text-sm">{{ t('debts.payment.unknown') }}</p>
                </div>

                <p v-if="installment">{{ t('debts.schedule.installment', { no: installment.installmentNo, date: formatDate(installment.dueDate) }) }}</p>

                <fieldset :disabled="saving || locked" class="space-y-5">
                    <div role="tablist" class="flex flex-wrap gap-2">
                        <button
                            v-for="(key, mode) in DEBT_TRANSACTION_MODE_KEYS"
                            :key="mode"
                            type="button"
                            role="tab"
                            class="btn btn-sm"
                            :class="form.mode === mode ? 'btn-primary' : 'btn-outline-primary'"
                            :aria-selected="form.mode === mode"
                            @click="form.mode = mode"
                        >
                            {{ t(key) }}
                        </button>
                    </div>

                    <div v-if="form.mode === 'create'" class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label for="debt-payment-account" class="mb-1 block text-sm font-medium">{{ t('debts.fields.account') }} *</label>
                            <select id="debt-payment-account" v-model="form.accountId" class="form-select" :disabled="vndAccounts.length === 0">
                                <option value="">{{ t('expected.payment.selectAccount') }}</option>
                                <option v-for="account in vndAccounts" :key="account.id" :value="account.id">{{ account.name || t('expected.account.unnamed') }}</option>
                            </select>
                            <p v-if="accountsLoading" role="status" class="mt-2 text-sm text-gray-500">{{ t('accounts.dropdown.loading') }}</p>
                            <div v-else-if="accountError" role="alert" class="mt-2 text-sm text-danger">
                                <p>{{ t('accounts.errors.loadFailedDetail', { error: displayText(accountError) }) }}</p>
                                <button type="button" class="btn btn-sm btn-outline-primary mt-2" @click="loadAccounts">{{ t('common.retry') }}</button>
                            </div>
                            <p v-else-if="vndAccounts.length === 0" role="alert" class="mt-2 text-sm text-warning">{{ t('debts.payment.noVndAccounts') }}</p>
                        </div>
                        <div>
                            <label for="debt-payment-date" class="mb-1 block text-sm font-medium">{{ t('debts.fields.paymentDate') }} *</label>
                            <input id="debt-payment-date" v-model="form.paymentDate" type="date" class="form-input" />
                        </div>
                    </div>
                    <template v-else>
                        <DebtTransactionPicker
                            :outgoing="debt.direction === 'Borrow'"
                            :selected="form.transaction"
                            @selected="pickTransaction"
                            @blocked="blocked => (transactionsBlocked = blocked)"
                        />
                        <!-- A payment of an installment is never part of the initial balance. -->
                        <div v-if="!installment">
                            <label class="flex items-center gap-2">
                                <input id="debt-payment-counted" v-model="form.countedInInitialBalance" type="checkbox" class="form-checkbox" />
                                <span>{{ t('debts.paymentStatus.countedInInitialBalance') }}</span>
                            </label>
                            <p class="mt-1 text-sm text-gray-500">{{ t('debts.payment.countedHint') }}</p>
                        </div>
                    </template>

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label for="debt-payment-principal" class="mb-1 block text-sm font-medium">{{ t('debts.fields.principal') }} *</label>
                            <input id="debt-payment-principal" v-model.trim="form.principal" type="text" inputmode="decimal" class="form-input" />
                            <p class="mt-1 text-sm text-gray-500">{{ t('debts.form.amountHint') }}</p>
                        </div>
                        <div>
                            <label for="debt-payment-interest" class="mb-1 block text-sm font-medium">{{ t('debts.fields.interest') }}</label>
                            <input id="debt-payment-interest" v-model.trim="form.interest" type="text" inputmode="decimal" class="form-input" />
                            <p class="mt-1 text-sm text-gray-500">{{ installment ? t('debts.payment.installmentHint') : t('debts.payment.interestHint') }}</p>
                        </div>
                    </div>
                </fieldset>

                <div class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <button type="button" class="btn btn-outline-secondary" @click="closeModal">{{ closeLabel }}</button>
                    <button type="submit" class="btn btn-primary" :disabled="saving || (form.mode === 'link' && transactionsBlocked)">{{ saving ? t('common.saving') : t('common.save') }}</button>
                </div>
            </form>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import DebtTransactionPicker from '~/components/apps/debts/DebtTransactionPicker.vue'
import { useAccountsSimple } from '~/composables/useAccountsSimple'
import { useAttemptKey, useDebtDialog } from '~/composables/useDebtDialog'
import { useDebts } from '~/composables/useDebts'
import type { Debt, DebtDisplayError, DebtInstallment, DebtPayment, DebtPaymentForm } from '~/types/debt'
import type { TransactionViewModel } from '~/types/transaction'
import { DEBT_TRANSACTION_MODE_KEYS, isUnknownOutcome, isVndAccount } from '~/utils/debt-formatters'
import { debtPaymentError, pickedInstallmentFields, pickedTransactionFields, toPaymentForm, toPaymentRequest } from '~/utils/debt-payment-rules'
import { formatDate } from '~/utils/display-format'
import { errorMessage } from '~/utils/expected-transaction-formatters'

// Records one payment of the debt, of the given installment or outside the schedule. The page unmounts it when the session
// changes.
const props = defineProps<{ debt: Debt; installment?: DebtInstallment | null }>()
const emit = defineEmits<{
    close: []
    saved: [payment: DebtPayment]
}>()

const { recordPayment } = useDebts()
const { accounts, isLoading: accountsLoading, error: accountError, getAccounts } = useAccountsSimple()
const { t } = useI18n()
// Closing is not a rollback: a pending command may still commit on the server.
const closeModal = (): void => emit('close')
const { dialog, isCurrent } = useDebtDialog(closeModal)
const form = reactive<DebtPaymentForm>(toPaymentForm(props.installment))
const attemptKey = useAttemptKey(() => toPaymentRequest(form))
const saving = ref(false)
// A payment whose outcome is unknown may already exist: only the same attempt can be sent again.
const locked = ref(false)
// Mirrors the loading or error state of the transaction picker.
const transactionsBlocked = ref(false)
const invalidKey = ref<string | null>(null)
const saveError = ref<DebtDisplayError | null>(null)

// A frontend message carries messageKey; a backend message is shown verbatim.
const displayText = (error: DebtDisplayError): string => (error.messageKey ? t(error.messageKey, error.messageParams ?? {}) : error.message)
const errorText = computed(() => {
    if (invalidKey.value) return t(invalidKey.value)
    return saveError.value ? t('debts.payment.saveFailed', { error: displayText(saveError.value) }) : ''
})
const heading = computed(() => (props.debt.direction === 'Borrow' ? t('debts.payment.recordBorrow') : t('debts.payment.recordLend')))
const closeLabel = computed(() => (saving.value ? t('expected.modal.closeWhileSaving') : t('common.close')))
const vndAccounts = computed(() => accounts.value.filter(isVndAccount))

const findInvalid = (): string | null => {
    const key = debtPaymentError(form)
    if (key || form.mode === 'link') return key
    return vndAccounts.value.some(account => account.id === form.accountId) ? null : 'debts.validation.paymentAccount'
}

const pickTransaction = (transaction: TransactionViewModel | null): void => {
    if (!isCurrent()) return
    if (!transaction) form.transaction = null
    else Object.assign(form, props.installment ? pickedInstallmentFields(props.installment, transaction) : pickedTransactionFields(props.debt, transaction))
}

const submit = async (): Promise<void> => {
    if (saving.value || !isCurrent()) return
    saveError.value = null
    invalidKey.value = findInvalid()
    if (invalidKey.value) return
    // The fields are disabled while saving; the focus stays in the dialog so that its keys keep working.
    dialog.value?.focus()
    saving.value = true
    try {
        const payment = await recordPayment(props.debt.id, form, attemptKey())
        if (isCurrent()) emit('saved', payment)
    } catch (error) {
        if (!isCurrent()) return
        saveError.value = errorMessage(error, 'debts.errors.checkAndRetry')
        locked.value = isUnknownOutcome(error)
        saving.value = false
    }
}

// The only VND account needs no choice.
const loadAccounts = async (): Promise<void> => {
    await getAccounts()
    if (isCurrent() && !form.accountId && vndAccounts.value.length === 1) form.accountId = vndAccounts.value[0].id
}

onMounted(loadAccounts)
</script>

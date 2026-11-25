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
                <button type="button" class="btn btn-sm btn-outline-secondary" @click="closeModal">{{ closeLabel }}</button>
            </div>

            <form class="space-y-5 p-5" novalidate @submit.prevent="submit">
                <div v-if="errorText" role="alert" class="rounded-lg border border-danger/20 bg-danger/10 p-3 text-danger">
                    <p>{{ errorText }}</p>
                    <p v-if="locked" class="mt-2 text-sm">{{ current ? t('debts.form.editLocked') : t('debts.form.createUnknown') }}</p>
                </div>

                <fieldset :disabled="saving || locked" class="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label for="debt-direction" class="mb-1 block text-sm font-medium">{{ t('debts.fields.direction') }} *</label>
                        <select id="debt-direction" v-model="form.direction" class="form-select" :disabled="!!current">
                            <option v-for="(key, value) in DEBT_DIRECTION_KEYS" :key="value" :value="value">{{ t(key) }}</option>
                        </select>
                        <p v-if="current" class="mt-1 text-sm text-gray-500">{{ t('debts.form.directionFixed') }}</p>
                    </div>
                    <div>
                        <label for="debt-type" class="mb-1 block text-sm font-medium">{{ t('debts.fields.type') }} *</label>
                        <select id="debt-type" v-model="form.debtType" class="form-select">
                            <option v-for="type in debtTypesFor(form.direction)" :key="type" :value="type">{{ t(DEBT_TYPE_KEYS[type]) }}</option>
                        </select>
                    </div>
                    <div>
                        <label for="debt-name" class="mb-1 block text-sm font-medium">{{ t('debts.fields.name') }} *</label>
                        <input id="debt-name" v-model="form.name" type="text" class="form-input" />
                    </div>
                    <div>
                        <label for="debt-counterparty" class="mb-1 block text-sm font-medium">{{ t('debts.fields.counterparty') }} *</label>
                        <input id="debt-counterparty" v-model="form.counterparty" type="text" class="form-input" />
                    </div>
                    <div>
                        <label for="debt-original-amount" class="mb-1 block text-sm font-medium">{{ t('debts.fields.originalAmount') }} *</label>
                        <input id="debt-original-amount" v-model.trim="form.originalAmount" type="text" inputmode="decimal" class="form-input" :disabled="closed" />
                        <p class="mt-1 text-sm text-gray-500">{{ t('debts.form.amountHint') }}</p>
                    </div>
                    <div>
                        <label for="debt-initial-balance" class="mb-1 block text-sm font-medium">{{ t('debts.fields.initialBalance') }}</label>
                        <input id="debt-initial-balance" v-model.trim="form.initialBalance" type="text" inputmode="decimal" class="form-input" :disabled="closed" />
                        <p v-if="!current" class="mt-1 text-sm text-gray-500">{{ t('debts.form.initialBalanceHint') }}</p>
                    </div>
                    <div>
                        <label for="debt-start-date" class="mb-1 block text-sm font-medium">{{ t('debts.fields.startDate') }} *</label>
                        <input id="debt-start-date" v-model="form.startDate" type="date" class="form-input" :disabled="!!current" />
                    </div>
                    <div>
                        <label for="debt-interest-rate" class="mb-1 block text-sm font-medium">{{ t('debts.fields.interestRate') }}</label>
                        <input id="debt-interest-rate" v-model.trim="form.interestRate" type="text" inputmode="decimal" class="form-input" :disabled="closed" />
                    </div>
                    <div>
                        <label for="debt-description" class="mb-1 block text-sm font-medium">{{ t('debts.fields.description') }}</label>
                        <textarea id="debt-description" v-model="form.description" rows="2" class="form-textarea" :disabled="closed"></textarea>
                    </div>
                    <div>
                        <label for="debt-notes" class="mb-1 block text-sm font-medium">{{ t('debts.fields.notes') }}</label>
                        <textarea id="debt-notes" v-model="form.notes" rows="2" class="form-textarea"></textarea>
                    </div>
                </fieldset>

                <fieldset v-if="!current" :disabled="saving || locked" class="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <label class="flex items-center gap-2">
                        <input id="debt-disbursement" v-model="form.recordDisbursement" type="checkbox" class="form-checkbox" />
                        <span>{{ t('debts.form.recordDisbursement') }}</span>
                    </label>
                    <div v-if="form.recordDisbursement">
                        <p class="mb-3 text-sm text-gray-500">{{ form.direction === 'Borrow' ? t('debts.form.disbursementIncome') : t('debts.form.disbursementExpense') }}</p>
                        <label for="debt-account" class="mb-1 block text-sm font-medium">{{ t('debts.fields.account') }} *</label>
                        <select id="debt-account" v-model="form.accountId" class="form-select" :disabled="vndAccounts.length === 0">
                            <option value="">{{ t('expected.payment.selectAccount') }}</option>
                            <option v-for="account in vndAccounts" :key="account.id" :value="account.id">{{ account.name || t('expected.account.unnamed') }}</option>
                        </select>
                        <p v-if="accountsLoading" role="status" class="mt-2 text-sm text-gray-500">{{ t('accounts.dropdown.loading') }}</p>
                        <div v-else-if="accountError" role="alert" class="mt-2 text-sm text-danger">
                            <p>{{ t('accounts.errors.loadFailedDetail', { error: displayText(accountError) }) }}</p>
                            <button type="button" class="btn btn-sm btn-outline-primary mt-2" @click="getAccounts()">{{ t('common.retry') }}</button>
                        </div>
                        <p v-else-if="vndAccounts.length === 0" role="alert" class="mt-2 text-sm text-warning">{{ t('debts.form.noVndAccounts') }}</p>
                    </div>
                </fieldset>

                <div class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <button type="button" class="btn btn-outline-secondary" @click="closeModal">{{ closeLabel }}</button>
                    <button type="submit" class="btn btn-primary" :disabled="saving || locked">{{ saving ? t('common.saving') : t('common.save') }}</button>
                </div>
            </form>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useAccountsSimple } from '~/composables/useAccountsSimple'
import { useDebts } from '~/composables/useDebts'
import { useAuthStore } from '~/stores/auth'
import type { ApiError } from '~/types/api'
import type { Debt, DebtDisplayError, DebtForm } from '~/types/debt'
import { DEBT_DIRECTION_KEYS, DEBT_TYPE_KEYS, canEditDebt, debtFormError, debtTypesFor, toDebtForm } from '~/utils/debt-formatters'
import { errorMessage } from '~/utils/expected-transaction-formatters'

// Creates a debt, or edits the given one. The page unmounts it when the session changes.
const props = defineProps<{ debt: Debt | null }>()
const emit = defineEmits<{
    close: []
    saved: [debt: Debt]
}>()

const auth = useAuthStore()
const { getDebt, createDebt, updateDebt } = useDebts()
const { accounts, isLoading: accountsLoading, error: accountError, getAccounts } = useAccountsSimple()
const { t } = useI18n()
const dialog = ref<HTMLElement | null>(null)
const current = ref<Debt | null>(props.debt)
const form = reactive<DebtForm>(toDebtForm(props.debt))
const saving = ref(false)
// A new debt whose outcome is unknown may already exist, and a refused edit needs the debt as it is now.
const locked = ref(false)
const invalidKey = ref<string | null>(null)
const saveError = ref<DebtDisplayError | null>(null)
const readController = new AbortController()
const openingToken = auth.token
let disposed = false
let previousFocus: HTMLElement | null = null

// A frontend message carries messageKey; a backend message is shown verbatim.
const displayText = (error: DebtDisplayError): string => (error.messageKey ? t(error.messageKey, error.messageParams ?? {}) : error.message)
const errorText = computed(() => {
    if (invalidKey.value) return t(invalidKey.value)
    return saveError.value ? t('debts.form.saveFailed', { error: displayText(saveError.value) }) : ''
})
const title = computed(() => (current.value ? t('debts.form.editTitle') : t('debts.form.createTitle')))
const closeLabel = computed(() => (saving.value ? t('expected.modal.closeWhileSaving') : t('common.close')))
const closed = computed(() => current.value?.status === 'Closed')
const vndAccounts = computed(() => accounts.value.filter(account => account.currency?.toUpperCase() === 'VND'))
const isCurrent = (): boolean => !disposed && auth.isAuthenticated && auth.token === openingToken

const findInvalid = (): string | null => {
    const key = debtFormError(form, current.value)
    if (key || !form.recordDisbursement) return key
    return vndAccounts.value.some(account => account.id === form.accountId) ? null : 'debts.validation.account'
}

// The answer to a refused edit: the fields follow the debt as it is now, and the typed text stays.
const reloadDebt = async (id: string): Promise<void> => {
    try {
        const fresh = await getDebt(id, readController.signal)
        if (!isCurrent()) return
        current.value = fresh
        locked.value = !canEditDebt(fresh)
    } catch {
        // The form stays locked; it can be closed and opened again.
    }
}

const submit = async (): Promise<void> => {
    if (saving.value || locked.value || !isCurrent()) return
    saveError.value = null
    invalidKey.value = findInvalid()
    if (invalidKey.value) return
    const edited = current.value
    // The fields are disabled while saving; the focus stays in the dialog so that its keys keep working.
    dialog.value?.focus()
    saving.value = true
    try {
        const saved = edited ? await updateDebt(edited, form) : await createDebt(form)
        if (isCurrent()) emit('saved', saved)
    } catch (error) {
        if (!isCurrent()) return
        saveError.value = errorMessage(error, 'debts.errors.checkAndRetry')
        const status = (error as Partial<ApiError> | null)?.statusCode ?? 0
        locked.value = edited ? status === 409 : status === 0 || status >= 500
        if (edited && locked.value) await reloadDebt(edited.id)
    } finally {
        if (isCurrent()) saving.value = false
    }
}

// Only the read is aborted: a pending command may still commit on the server.
const closeModal = (): void => emit('close')

const handleDialogKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
        event.preventDefault()
        closeModal()
        return
    }
    if (event.key !== 'Tab' || !dialog.value) return
    const controls = Array.from(dialog.value.querySelectorAll<HTMLElement>('button, input, select, textarea')).filter(control => !control.matches(':disabled'))
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) {
        event.preventDefault()
        last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
    }
}

watch(() => form.direction, direction => {
    if (!current.value) form.debtType = debtTypesFor(direction)[0]
})
watch(() => form.recordDisbursement, record => {
    if (record) void getAccounts()
})

onMounted(() => {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    void nextTick(() => dialog.value?.focus())
})
onBeforeUnmount(() => {
    // Focus goes back after an ordinary dismissal, never after a session change.
    const restoreFocus = isCurrent()
    disposed = true
    readController.abort()
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus()
})
</script>

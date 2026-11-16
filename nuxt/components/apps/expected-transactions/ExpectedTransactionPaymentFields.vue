<template>
    <div class="grid gap-4 sm:grid-cols-2">
        <div>
            <label for="payment-amount" class="mb-1 block text-sm font-medium">{{ t('expected.payment.amount') }}</label>
            <input id="payment-amount" type="text" class="form-input bg-gray-100 dark:bg-gray-800" :value="formatCurrency(transaction.expectedAmount)" readonly />
        </div>
        <div>
            <label for="payment-date" class="mb-1 block text-sm font-medium">{{ t('expected.payment.date') }}</label>
            <input id="payment-date" type="text" class="form-input bg-gray-100 dark:bg-gray-800" :value="formatDate(transaction.expectedDate)" readonly />
        </div>
    </div>
    <p class="text-sm text-gray-500">{{ t('expected.payment.fixedNote') }}</p>
    <div>
        <template v-if="transaction.accountId">
            <label for="payment-bound-account" class="mb-1 block text-sm font-medium">{{ t('expected.payment.boundAccount') }}</label>
            <input id="payment-bound-account" type="text" class="form-input bg-gray-100 dark:bg-gray-800" :value="boundAccountLabel" readonly />
        </template>
        <template v-else>
            <label for="payment-account" class="mb-1 block text-sm font-medium">{{ t('expected.payment.account') }} *</label>
            <select id="payment-account" v-model="accountId" class="form-select" :disabled="selectDisabled" required>
                <option value="">{{ t('expected.payment.selectAccount') }}</option>
                <option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name || t('expected.account.unnamed') }}</option>
            </select>
            <p class="mt-1 text-sm text-gray-500">{{ t('expected.payment.accountHint') }}</p>
        </template>
        <p v-if="accountsLoading" role="status" class="mt-2 text-sm text-gray-500">{{ t('accounts.dropdown.loading') }}</p>
        <div v-else-if="accountError" role="alert" class="mt-2 text-sm text-danger">
            <p>{{ t('accounts.errors.loadFailedDetail', { error: accountErrorText }) }}</p>
            <button type="button" class="btn btn-sm btn-outline-primary mt-2" :disabled="saving" @click="emit('retry')">{{ t('expected.payment.retryAccounts') }}</button>
        </div>
        <p v-else-if="accounts.length === 0" role="alert" class="mt-2 text-sm text-warning">{{ t('expected.payment.noAccounts') }}</p>
        <p v-else-if="transaction.accountId && !paymentAccountAvailable" role="alert" class="mt-2 text-sm text-warning">{{ t('expected.payment.boundAccountUnavailable') }}</p>
    </div>
    <p class="rounded-lg bg-info/10 p-3 text-sm text-info">{{ t('expected.payment.notice') }}</p>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AccountSelection } from '~/types/account'
import type { ApiError } from '~/types/api'
import type { ExpectedTransactionViewModel } from '~/types/recurring-transaction'
import { formatCurrency, formatDate } from '~/utils/expected-transaction-formatters'

// Presentational: the modal owns the account read, the selection and every lock that feeds selectDisabled.
const props = defineProps<{
    transaction: ExpectedTransactionViewModel
    accounts: ReadonlyArray<Readonly<AccountSelection>>
    accountsLoading: boolean
    accountError: Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null
    paymentAccountAvailable: boolean
    selectDisabled: boolean
    saving: boolean
    modelValue: string
}>()
const emit = defineEmits<{
    'update:modelValue': [accountId: string]
    retry: []
}>()

const { t } = useI18n()

const accountId = computed({
    get: () => props.modelValue,
    set: value => emit('update:modelValue', value)
})
const boundAccountLabel = computed(() => {
    const transaction = props.transaction
    if (!transaction.accountId) return t('expected.account.none')
    return transaction.accountName || props.accounts.find(account => account.id === transaction.accountId)?.name || t('expected.account.unavailable')
})
// A frontend message carries messageKey; a backend message is shown verbatim.
const accountErrorText = computed(() => {
    const apiError = props.accountError
    return apiError?.messageKey ? t(apiError.messageKey, apiError.messageParams ?? {}) : apiError?.message || t('accounts.errors.loadFailed')
})
</script>

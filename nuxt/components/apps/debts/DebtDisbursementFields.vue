<template>
    <fieldset :disabled="disabled" class="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <label class="flex items-center gap-2">
            <input id="debt-disbursement" v-model="recordDisbursement" type="checkbox" class="form-checkbox" />
            <span>{{ t('debts.form.recordDisbursement') }}</span>
        </label>
        <template v-if="recordDisbursement">
            <div class="flex flex-wrap gap-4">
                <label v-for="(key, mode) in DEBT_TRANSACTION_MODE_KEYS" :key="mode" class="flex items-center gap-2">
                    <input v-model="disbursementMode" type="radio" name="debt-disbursement-mode" class="form-radio" :value="mode" />
                    <span>{{ t(key) }}</span>
                </label>
            </div>
            <div v-if="disbursementMode === 'create'">
                <p class="mb-3 text-sm text-gray-500">{{ form.direction === 'Borrow' ? t('debts.form.disbursementIncome') : t('debts.form.disbursementExpense') }}</p>
                <label for="debt-account" class="mb-1 block text-sm font-medium">{{ t('debts.fields.account') }} *</label>
                <select id="debt-account" v-model="accountId" class="form-select" :disabled="accounts.length === 0">
                    <option value="">{{ t('expected.payment.selectAccount') }}</option>
                    <option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name || t('expected.account.unnamed') }}</option>
                </select>
                <p v-if="accountsLoading" role="status" class="mt-2 text-sm text-gray-500">{{ t('accounts.dropdown.loading') }}</p>
                <div v-else-if="accountError" role="alert" class="mt-2 text-sm text-danger">
                    <p>{{ t('accounts.errors.loadFailedDetail', { error: accountErrorText }) }}</p>
                    <button type="button" class="btn btn-sm btn-outline-primary mt-2" @click="emit('retry')">{{ t('common.retry') }}</button>
                </div>
                <p v-else-if="accounts.length === 0" role="alert" class="mt-2 text-sm text-warning">{{ t('debts.form.noVndAccounts') }}</p>
            </div>
            <template v-else>
                <p class="text-sm text-gray-500">{{ t('debts.form.disbursementLink') }}</p>
                <!-- A disbursement moves the money the other way round than a payment. -->
                <DebtTransactionPicker
                    :key="form.direction"
                    :outgoing="form.direction === 'Lend'"
                    :selected="form.transaction"
                    @selected="transaction => emit('change', { transaction })"
                    @blocked="blocked => emit('blocked', blocked)"
                />
            </template>
        </template>
    </fieldset>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DebtTransactionPicker from '~/components/apps/debts/DebtTransactionPicker.vue'
import type { AccountSelection } from '~/types/account'
import type { DebtDisplayError, DebtForm } from '~/types/debt'
import { DEBT_TRANSACTION_MODE_KEYS } from '~/utils/debt-formatters'

// Presentational: the modal owns the form and the read of the VND accounts; the picker owns the read of the transactions.
const props = defineProps<{
    form: DebtForm
    accounts: ReadonlyArray<Readonly<AccountSelection>>
    accountsLoading: boolean
    accountError: DebtDisplayError | null
    disabled: boolean
}>()
const emit = defineEmits<{
    change: [changes: Partial<DebtForm>]
    blocked: [blocked: boolean]
    retry: []
}>()

const { t } = useI18n()

const field = <K extends 'recordDisbursement' | 'disbursementMode' | 'accountId'>(key: K) => computed({
    get: () => props.form[key],
    set: (value: DebtForm[K]) => emit('change', { [key]: value })
})
const recordDisbursement = field('recordDisbursement')
const disbursementMode = field('disbursementMode')
const accountId = field('accountId')
// A frontend message carries messageKey; a backend message is shown verbatim.
const accountErrorText = computed(() => (props.accountError?.messageKey ? t(props.accountError.messageKey, props.accountError.messageParams ?? {}) : props.accountError?.message))
</script>

<template>
    <section class="panel">
        <h2 class="mb-5 text-lg font-semibold">{{ t('debts.history.heading') }}</h2>
        <p v-if="payments.length === 0" class="py-6 text-center text-gray-500">{{ t('debts.history.empty') }}</p>
        <div v-else class="table-responsive">
            <table class="table-hover">
                <thead>
                    <tr>
                        <th>{{ t('debts.fields.paymentDate') }}</th>
                        <th>{{ t('debts.fields.principal') }}</th>
                        <th>{{ t('debts.fields.interest') }}</th>
                        <th>{{ t('common.status') }}</th>
                        <th>{{ t('debts.columns.transaction') }}</th>
                        <th v-if="hasPaymentActions(debt)">{{ t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="payment in payments" :key="payment.id">
                        <td class="whitespace-nowrap">{{ formatDate(payment.paymentDate) }}</td>
                        <td class="whitespace-nowrap">{{ formatDebtAmount(payment.principal) }}</td>
                        <td class="whitespace-nowrap">{{ formatDebtAmount(payment.interest) }}</td>
                        <td>
                            <span class="badge whitespace-nowrap" :class="debtPaymentStatusClass(payment.status)">{{ labelText(debtLabel(DEBT_PAYMENT_STATUS_KEYS, payment.status)) }}</span>
                            <p v-if="payment.countedInInitialBalance && payment.status !== 'CountedInInitialBalance'" class="mt-1 text-sm text-info">
                                {{ t('debts.paymentStatus.countedInInitialBalance') }}
                            </p>
                            <p v-if="payment.pendingOperation" class="mt-1 text-sm text-warning">{{ labelText(debtLabel(DEBT_OPERATION_KEYS, payment.pendingOperation)) }}</p>
                        </td>
                        <td class="max-w-xs break-all text-xs text-gray-500">{{ payment.transactionId || '-' }}</td>
                        <td v-if="hasPaymentActions(debt)" class="min-w-[160px]">
                            <div v-if="payment.status !== 'Cancelled'" class="flex flex-wrap gap-2">
                                <button
                                    v-if="payment.status === 'Pending'"
                                    type="button"
                                    class="btn btn-sm btn-outline-primary"
                                    :disabled="disabled || !canResyncPayment(debt, payment)"
                                    @click="emit('resync', payment)"
                                >
                                    {{ t('debts.pendingSync.action') }}
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-danger" :disabled="disabled || !canCancelPayment(debt, payment)" @click="emit('cancel', payment)">
                                    {{ t('debts.cancelPayment.action') }}
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>
</template>

<script setup lang="ts">
import type { Debt, DebtPayment } from '~/types/debt'
import { DEBT_OPERATION_KEYS, debtLabel, formatDebtAmount } from '~/utils/debt-formatters'
import { DEBT_PAYMENT_STATUS_KEYS, canCancelPayment, canResyncPayment, debtPaymentStatusClass, hasPaymentActions } from '~/utils/debt-payment-rules'
import { formatDate } from '~/utils/display-format'
import type { DisplayLabel } from '~/utils/expected-transaction-formatters'

// Presentational: the page owns the reads and every action. disabled is set while an action runs.
defineProps<{ debt: Debt; payments: DebtPayment[]; disabled: boolean }>()
const emit = defineEmits<{
    resync: [payment: DebtPayment]
    cancel: [payment: DebtPayment]
}>()

const { t } = useI18n()

const labelText = (label: DisplayLabel): string => ('raw' in label ? label.raw : t(label.key))
</script>

<template>
    <section class="panel" :aria-busy="loading">
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-lg font-semibold">{{ t('debts.schedule.heading') }}</h2>
            <template v-if="hasScheduleActions(debt)">
                <button v-if="!hasSchedule" type="button" class="btn btn-sm btn-primary" :disabled="locked" @click="emit('open', 'createSchedule', null)">{{ t('debts.schedule.create') }}</button>
                <button v-else type="button" class="btn btn-sm btn-outline-primary" :disabled="locked" @click="emit('open', 'recalculate', null)">{{ t('debts.schedule.recalculate') }}</button>
            </template>
        </div>

        <p v-if="!hasSchedule" class="py-6 text-center text-gray-500">{{ t('debts.schedule.none') }}</p>
        <p v-else-if="loadError ? loading : !installments" role="status" class="py-6 text-center text-gray-500">{{ t('debts.schedule.loading') }}</p>
        <div v-else-if="loadError" role="alert" class="rounded-lg border border-danger/20 bg-danger/10 p-4 text-danger">
            <p>{{ t('debts.schedule.loadFailed', { error: errorText }) }}</p>
            <button type="button" class="btn btn-sm btn-outline-primary mt-3" @click="loadInstallments">{{ t('common.retry') }}</button>
        </div>
        <p v-else-if="rows.length === 0" class="py-6 text-center text-gray-500">{{ t('debts.schedule.empty') }}</p>
        <div v-else class="table-responsive max-h-[70vh]">
            <table class="table-hover">
                <thead>
                    <tr>
                        <th>{{ t('debts.columns.installmentNo') }}</th>
                        <th>{{ t('debts.columns.dueDate') }}</th>
                        <th>{{ t('debts.columns.plannedPrincipal') }}</th>
                        <th>{{ t('debts.columns.plannedInterest') }}</th>
                        <th>{{ t('debts.columns.plannedTotal') }}</th>
                        <th>{{ t('debts.columns.actualPrincipal') }}</th>
                        <th>{{ t('debts.columns.actualInterest') }}</th>
                        <th>{{ t('common.status') }}</th>
                        <th v-if="hasScheduleActions(debt)">{{ t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in rows" :key="row.installment.id">
                        <td>{{ row.installment.installmentNo }}</td>
                        <td class="whitespace-nowrap">{{ row.dueDate }}</td>
                        <td class="whitespace-nowrap">
                            {{ row.principal }}
                            <p v-if="row.originalPrincipal" class="text-xs text-gray-500">{{ row.originalPrincipal }}</p>
                        </td>
                        <td class="whitespace-nowrap">
                            {{ row.interest }}
                            <p v-if="row.originalInterest" class="text-xs text-gray-500">{{ row.originalInterest }}</p>
                        </td>
                        <td class="whitespace-nowrap">{{ row.amount }}</td>
                        <td class="whitespace-nowrap">{{ row.actualPrincipal }}</td>
                        <td class="whitespace-nowrap">{{ row.actualInterest }}</td>
                        <td class="min-w-[160px] max-w-xs">
                            <span class="badge whitespace-nowrap" :class="row.statusClass">{{ row.status }}</span>
                            <span v-if="row.overdue" class="badge badge-outline-danger ml-1 whitespace-nowrap">{{ row.overdue }}</span>
                            <p v-if="row.waiting" class="mt-1 text-sm text-warning">{{ row.waiting }}</p>
                            <p v-if="row.adjusted" class="mt-1 text-sm text-info">{{ row.adjusted }}</p>
                            <p v-if="row.reason" class="whitespace-pre-line break-words text-sm text-gray-500">{{ row.reason }}</p>
                        </td>
                        <td v-if="hasScheduleActions(debt)" class="min-w-[200px]">
                            <div v-if="row.open" class="flex flex-wrap gap-2">
                                <button type="button" class="btn btn-sm btn-outline-primary" :disabled="locked" @click="emit('open', 'pay', row.installment)">{{ recordLabel }}</button>
                                <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="locked" @click="emit('open', 'adjust', row.installment)">{{ adjustLabel }}</button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useDebts } from '~/composables/useDebts'
import { useExpectedTransactions } from '~/composables/useExpectedTransactions'
import { useAuthStore } from '~/stores/auth'
import type { Debt, DebtDetailDialog, DebtDisplayError } from '~/types/debt'
import type { DebtInstallment } from '~/types/debt-schedule'
import { debtLabel, formatDebtAmount, todayInVietnam } from '~/utils/debt-formatters'
import {
    DEBT_INSTALLMENT_STATUS_KEYS,
    canWriteSchedule,
    debtInstallmentStatusClass,
    hasScheduleActions,
    isOpenInstallment,
    isOverdueInstallment
} from '~/utils/debt-schedule-rules'
import { formatDate } from '~/utils/display-format'
import { errorMessage } from '~/utils/expected-transaction-formatters'
import type { DisplayLabel } from '~/utils/expected-transaction-formatters'

// Owns the read of the installments, which also asks the accounting service: when that fails, the rest of the page stays
// usable. The page owns the dialogs and every action; disabled is set while an action runs.
const props = defineProps<{ debt: Debt; disabled: boolean }>()
const emit = defineEmits<{ open: [dialog: DebtDetailDialog, installment: DebtInstallment | null] }>()

const auth = useAuthStore()
const { getInstallments } = useDebts()
const { revision } = useExpectedTransactions()
const { t } = useI18n()

const hasSchedule = computed(() => props.debt.scheduleVersion > 0)
// Null until they were read. Shallow, because a schedule can have thousands of rows.
const installments = shallowRef<DebtInstallment[] | null>(null)
const today = ref('')
const loading = ref(false)
const loadError = ref<DebtDisplayError | null>(null)
let mounted = false
let sequence = 0
let controller: AbortController | null = null

// A frontend message carries messageKey; a backend message is shown verbatim.
const errorText = computed(() => (loadError.value?.messageKey ? t(loadError.value.messageKey, loadError.value.messageParams ?? {}) : loadError.value?.message))
const labelText = (label: DisplayLabel): string => ('raw' in label ? label.raw : t(label.key))
const locked = computed(() => props.disabled || !canWriteSchedule(props.debt))
const recordLabel = computed(() => t('debts.schedule.record'))
const adjustLabel = computed(() => t('debts.schedule.adjust'))

const originalText = (amount: number | null): string => t('debts.schedule.original', { amount: formatDebtAmount(amount) })
// Texts are made once per read and locale, so a busy flag does not format thousands of rows again.
const rows = computed(() =>
    (installments.value ?? []).map(installment => ({
        installment,
        dueDate: formatDate(installment.dueDate),
        principal: formatDebtAmount(installment.principal),
        interest: formatDebtAmount(installment.interest),
        amount: formatDebtAmount(installment.amount),
        originalPrincipal: installment.isAdjusted ? originalText(installment.originalPrincipal) : '',
        originalInterest: installment.isAdjusted ? originalText(installment.originalInterest) : '',
        actualPrincipal: formatDebtAmount(installment.payment?.principal),
        actualInterest: formatDebtAmount(installment.payment?.interest),
        status: labelText(debtLabel(DEBT_INSTALLMENT_STATUS_KEYS, installment.status)),
        statusClass: debtInstallmentStatusClass(installment.status),
        overdue: isOverdueInstallment(installment, today.value) ? t('enums.expectedTransactionStatus.overdue') : '',
        waiting: installment.payment?.status === 'Pending' ? t('debts.paymentStatus.pending') : '',
        adjusted: installment.isAdjusted ? t('expected.fields.adjusted') : '',
        reason: installment.isAdjusted && installment.adjustmentReason ? `${t('expected.fields.reason')}: ${installment.adjustmentReason}` : '',
        open: isOpenInstallment(installment)
    }))
)

const invalidate = (): void => {
    sequence += 1
    controller?.abort()
    controller = null
    loading.value = false
}

const loadInstallments = async (): Promise<void> => {
    invalidate()
    if (!mounted || !hasSchedule.value || !auth.isAuthenticated || !auth.token) return
    const requestSequence = sequence
    const requestToken = auth.token
    const requestController = new AbortController()
    controller = requestController
    const isCurrent = () => mounted && requestSequence === sequence && auth.token === requestToken && !requestController.signal.aborted
    loading.value = true
    try {
        const response = await getInstallments(props.debt.id, requestController.signal)
        if (!isCurrent()) return
        today.value = todayInVietnam()
        installments.value = response
        loadError.value = null
    } catch (error) {
        // A failed read never leaves a stale schedule next to the error.
        if (isCurrent()) loadError.value = errorMessage(error, 'common.errors.loadFailed')
    } finally {
        if (isCurrent()) {
            loading.value = false
            controller = null
        }
    }
}

watch(() => [auth.token, auth.isAuthenticated], () => {
    invalidate()
    installments.value = null
    loadError.value = null
    void loadInstallments()
}, { flush: 'sync' })
// The revision moves before the page knows about the first version, so that version reloads as well.
watch([revision, hasSchedule], () => void loadInstallments(), { flush: 'post' })

onMounted(() => {
    mounted = true
    void loadInstallments()
})
onBeforeUnmount(() => {
    mounted = false
    invalidate()
})
</script>

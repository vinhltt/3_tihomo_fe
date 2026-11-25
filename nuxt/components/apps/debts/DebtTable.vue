<template>
    <section class="panel" :aria-busy="loading">
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-lg font-semibold">{{ t('debts.list.heading') }}</h2>
            <button type="button" class="btn btn-sm btn-outline-primary" :disabled="loading || !authenticated" @click="emit('reload')">{{ t('debts.list.reload') }}</button>
        </div>

        <div v-if="loading" role="status" class="py-12 text-center text-gray-500">{{ t('debts.list.loading') }}</div>
        <div v-else-if="listError" role="alert" class="rounded-lg border border-danger/20 bg-danger/10 p-4 text-danger">
            <p>{{ t('debts.list.loadFailed', { error: listError }) }}</p>
            <button type="button" class="btn btn-sm btn-outline-primary mt-3" @click="emit('reload')">{{ t('common.retry') }}</button>
        </div>
        <p v-else-if="!authenticated" class="py-12 text-center text-gray-500">{{ t('debts.list.signInRequired') }}</p>
        <p v-else-if="debts.length === 0" class="py-12 text-center text-gray-500">{{ t('debts.list.empty') }}</p>
        <div v-else class="table-responsive">
            <table class="table-hover">
                <thead>
                    <tr>
                        <th>{{ t('debts.columns.nameCounterparty') }}</th>
                        <th>{{ t('debts.columns.directionType') }}</th>
                        <th>{{ t('debts.fields.originalAmount') }}</th>
                        <th>{{ t('debts.fields.currentBalance') }}</th>
                        <th>{{ t('debts.fields.progress') }}</th>
                        <th>{{ t('debts.fields.startDate') }}</th>
                        <th>{{ t('common.status') }}</th>
                        <th>{{ t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="debt in debts" :key="debt.id">
                        <td class="min-w-[200px] max-w-xs">
                            <p class="break-words font-semibold">{{ debt.name }}</p>
                            <p v-if="debt.counterparty" class="mt-1 break-words text-sm">{{ debt.counterparty }}</p>
                            <DebtPendingSyncAlert :debt="debt" />
                        </td>
                        <td>
                            <p>{{ labelText(debtLabel(DEBT_DIRECTION_KEYS, debt.direction)) }}</p>
                            <p class="mt-1 text-sm text-gray-500">{{ labelText(debtLabel(DEBT_TYPE_KEYS, debt.debtType)) }}</p>
                        </td>
                        <td class="whitespace-nowrap">{{ formatDebtAmount(debt.originalAmount) }}</td>
                        <td class="whitespace-nowrap font-semibold">{{ formatDebtAmount(debt.currentBalance) }}</td>
                        <td class="whitespace-nowrap">{{ formatNumber(debt.progress) }}%</td>
                        <td class="whitespace-nowrap">{{ formatDate(debt.startDate) }}</td>
                        <td>
                            <span class="badge whitespace-nowrap" :class="debtStatusClass(debt.status)">{{ labelText(debtLabel(DEBT_STATUS_KEYS, debt.status)) }}</span>
                            <p v-if="isDebtBusy(debt)" class="mt-1 text-sm text-warning">{{ labelText(debtLabel(DEBT_OPERATION_KEYS, debt.pendingOperation)) }}</p>
                        </td>
                        <td class="min-w-[200px]">
                            <div class="flex flex-wrap gap-2">
                                <button
                                    v-if="isDebtBusy(debt) || debt.status === 'Provisioning'"
                                    type="button"
                                    class="btn btn-sm btn-outline-primary"
                                    :disabled="!!actionId"
                                    @click="emit('retry', debt)"
                                >
                                    {{ t('common.retry') }}
                                </button>
                                <template v-if="debt.status !== 'Provisioning'">
                                    <button type="button" class="btn btn-sm btn-outline-primary" :disabled="!!actionId || !canEditDebt(debt)" @click="emit('edit', debt)">{{ t('common.edit') }}</button>
                                    <button type="button" class="btn btn-sm btn-outline-warning" :disabled="!!actionId || !canCloseDebt(debt)" @click="emit('close', debt)">{{ t('debts.close.action') }}</button>
                                </template>
                                <button type="button" class="btn btn-sm btn-outline-danger" :disabled="!!actionId || !canDeleteDebt(debt)" @click="emit('delete', debt)">
                                    {{ debt.status === 'Provisioning' ? t('common.cancel') : t('common.delete') }}
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="!loading && !listError && pagination.totalRow > 0" class="mt-5 flex flex-wrap items-center justify-between gap-4">
            <p class="text-sm text-gray-500">{{ t('debts.list.summary', { from: firstRow, to: lastRow, total: pagination.totalRow }) }}</p>
            <div class="flex items-center gap-2">
                <button type="button" class="btn btn-sm btn-outline-primary" :disabled="pagination.pageIndex <= 1" @click="emit('change-page', pagination.pageIndex - 1)">{{ t('common.previous') }}</button>
                <span class="text-sm">{{ t('transactions.pagination.page', { current: pagination.pageIndex, total: pagination.pageCount }) }}</span>
                <button type="button" class="btn btn-sm btn-outline-primary" :disabled="pagination.pageIndex >= pagination.pageCount" @click="emit('change-page', pagination.pageIndex + 1)">{{ t('common.next') }}</button>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DebtPendingSyncAlert from '~/components/apps/debts/DebtPendingSyncAlert.vue'
import type { Pagination } from '~/types/api'
import type { Debt } from '~/types/debt'
import {
    DEBT_DIRECTION_KEYS,
    DEBT_OPERATION_KEYS,
    DEBT_STATUS_KEYS,
    DEBT_TYPE_KEYS,
    canCloseDebt,
    canDeleteDebt,
    canEditDebt,
    debtLabel,
    debtStatusClass,
    formatDebtAmount,
    isDebtBusy
} from '~/utils/debt-formatters'
import { formatDate, formatNumber } from '~/utils/display-format'
import type { DisplayLabel } from '~/utils/expected-transaction-formatters'

// Presentational: the page owns loading, paging requests and every action. actionId is the debt whose action is running.
// listError is the resolved error text; the page translates it so it follows a locale switch.
const props = defineProps<{
    debts: Debt[]
    pagination: Pagination
    loading: boolean
    listError: string | null
    authenticated: boolean
    actionId: string | null
}>()
const emit = defineEmits<{
    edit: [debt: Debt]
    close: [debt: Debt]
    delete: [debt: Debt]
    retry: [debt: Debt]
    'change-page': [page: number]
    reload: []
}>()

const { t } = useI18n()

const labelText = (label: DisplayLabel): string => ('raw' in label ? label.raw : t(label.key))
const firstRow = computed(() => (props.pagination.pageIndex - 1) * props.pagination.pageSize + 1)
const lastRow = computed(() => Math.min(props.pagination.pageIndex * props.pagination.pageSize, props.pagination.totalRow))
</script>

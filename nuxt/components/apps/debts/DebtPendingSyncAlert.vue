<template>
    <template v-if="detailed">
        <section v-if="isDebtBusy(debt)" role="alert" class="panel flex items-start justify-between gap-4 border border-warning/30 bg-warning/10">
            <p class="text-warning">{{ t('debts.pendingSync.busy', { operation: labelText(debtLabel(DEBT_OPERATION_KEYS, debt.pendingOperation)) }) }}</p>
            <button type="button" class="btn btn-sm btn-outline-warning shrink-0" :disabled="disabled" @click="emit('resync')">{{ t('debts.pendingSync.action') }}</button>
        </section>
        <section v-if="debt.labelsSyncPending" role="status" class="panel flex items-start justify-between gap-4 border border-warning/30 bg-warning/10">
            <p class="text-warning">{{ t('debts.pendingSync.labels') }}</p>
            <button type="button" class="btn btn-sm btn-outline-warning shrink-0" :disabled="disabled" @click="emit('resync')">{{ t('common.retry') }}</button>
        </section>
    </template>
    <p v-if="debt.hasPendingPayments" role="status" class="mt-2 rounded-lg border border-warning/30 bg-warning/10 p-2 text-sm text-warning">{{ t('debts.pendingSync.payments') }}</p>
</template>

<script setup lang="ts">
import type { Debt } from '~/types/debt'
import { DEBT_OPERATION_KEYS, debtLabel, isDebtBusy } from '~/utils/debt-formatters'
import type { DisplayLabel } from '~/utils/expected-transaction-formatters'

// A list row only warns about the payments. The detailed form also offers the resync of the debt; disabled is set while an action runs.
defineProps<{ debt: Debt; detailed?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ resync: [] }>()

const { t } = useI18n()

const labelText = (label: DisplayLabel): string => ('raw' in label ? label.raw : t(label.key))
</script>

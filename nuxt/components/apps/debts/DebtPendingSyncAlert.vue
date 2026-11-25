<template>
    <p v-if="debt.hasPendingPayments" role="status" class="mt-2 rounded-lg border border-warning/30 bg-warning/10 p-2 text-sm text-warning">{{ t('debts.pendingSync.payments') }}</p>
</template>

<script setup lang="ts">
import type { Debt } from '~/types/debt'

defineProps<{ debt: Debt }>()

const { t } = useI18n()
</script>

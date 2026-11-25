<template>
    <section class="panel" :aria-busy="loading">
        <div v-if="errorText" role="alert" class="rounded-lg border border-danger/20 bg-danger/10 p-4 text-danger">
            <p>{{ t('debts.totals.loadFailed', { error: errorText }) }}</p>
            <button type="button" class="btn btn-sm btn-outline-primary mt-3" @click="loadTotals">{{ t('common.retry') }}</button>
        </div>
        <div v-else class="grid gap-4 sm:grid-cols-2">
            <div>
                <p class="text-sm text-gray-500">{{ t('debts.totals.borrowed') }}</p>
                <p id="debt-total-borrowed" class="mt-1 text-2xl font-semibold text-danger">{{ formatDebtAmount(totals?.borrowed) }}</p>
            </div>
            <div>
                <p class="text-sm text-gray-500">{{ t('debts.totals.lent') }}</p>
                <p id="debt-total-lent" class="mt-1 text-2xl font-semibold text-success">{{ formatDebtAmount(totals?.lent) }}</p>
            </div>
        </div>
        <p class="mt-3 text-sm text-gray-500">{{ t('debts.totals.note') }}</p>
    </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDebts } from '~/composables/useDebts'
import { useExpectedTransactions } from '~/composables/useExpectedTransactions'
import { useAuthStore } from '~/stores/auth'
import type { DebtDisplayError, DebtTotals } from '~/types/debt'
import { formatDebtAmount } from '~/utils/debt-formatters'
import { errorMessage } from '~/utils/expected-transaction-formatters'

// Owns the totals read. Every debt mutation moves the shared revision, which reloads the totals.
const auth = useAuthStore()
const { getTotals } = useDebts()
const { revision } = useExpectedTransactions()
const totals = ref<DebtTotals | null>(null)
const loading = ref(false)
const error = ref<DebtDisplayError | null>(null)
let mounted = false
let sequence = 0
let controller: AbortController | null = null

const { t } = useI18n()

// A frontend message carries messageKey; a backend message is shown verbatim.
const errorText = computed(() => (error.value?.messageKey ? t(error.value.messageKey, error.value.messageParams ?? {}) : error.value?.message))

const invalidate = (): void => {
    sequence += 1
    controller?.abort()
    controller = null
    loading.value = false
}

const loadTotals = async (): Promise<void> => {
    invalidate()
    if (!mounted || !auth.isAuthenticated || !auth.token) return
    const requestSequence = sequence
    const requestToken = auth.token
    const requestController = new AbortController()
    controller = requestController
    const isCurrent = () => mounted && requestSequence === sequence && auth.token === requestToken && !requestController.signal.aborted
    loading.value = true
    try {
        const response = await getTotals(requestController.signal)
        if (!isCurrent()) return
        totals.value = response
        error.value = null
    } catch (err) {
        // A failed read never leaves stale totals next to the error.
        if (isCurrent()) error.value = errorMessage(err, 'common.errors.loadFailed')
    } finally {
        if (isCurrent()) {
            loading.value = false
            controller = null
        }
    }
}

watch(() => [auth.token, auth.isAuthenticated], () => {
    invalidate()
    totals.value = null
    error.value = null
    void loadTotals()
}, { flush: 'sync' })
watch(revision, () => void loadTotals(), { flush: 'post' })

onMounted(() => {
    mounted = true
    void loadTotals()
})
onBeforeUnmount(() => {
    mounted = false
    invalidate()
})
</script>

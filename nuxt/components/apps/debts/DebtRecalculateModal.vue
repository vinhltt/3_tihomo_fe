<template>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="closeModal">
        <section
            ref="dialog"
            role="dialog"
            aria-modal="true"
            :aria-label="t('debts.schedule.recalculate')"
            tabindex="-1"
            class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl outline-none dark:bg-[#0e1726]"
        >
            <div class="flex items-center justify-between gap-4 border-b border-gray-200 p-5 dark:border-gray-700">
                <h2 class="text-lg font-semibold">{{ t('debts.schedule.recalculate') }}</h2>
                <button type="button" class="btn btn-sm btn-outline-secondary" @click="closeModal">{{ closeLabel }}</button>
            </div>

            <form class="space-y-5 p-5" novalidate @submit.prevent="submit">
                <div v-if="errorText" role="alert" class="rounded-lg border border-danger/20 bg-danger/10 p-3 text-danger">
                    <p>{{ errorText }}</p>
                    <p v-if="locked" class="mt-2 text-sm">{{ t('debts.schedule.unknown') }}</p>
                </div>

                <p v-if="previewing" role="status" class="py-6 text-center text-gray-500">{{ t('debts.schedule.previewLoading') }}</p>
                <div v-else-if="previewError" role="alert" class="rounded-lg border border-danger/20 bg-danger/10 p-3 text-danger">
                    <p>{{ t('debts.schedule.previewFailed', { error: displayText(previewError) }) }}</p>
                    <button type="button" class="btn btn-sm btn-outline-primary mt-2" @click="loadPreview">{{ t('common.retry') }}</button>
                </div>
                <template v-else-if="preview">
                    <dl class="grid gap-4 sm:grid-cols-3">
                        <div v-for="[key, value] in facts" :key="key">
                            <dt class="text-sm text-gray-500">{{ t(key) }}</dt>
                            <dd class="mt-1 font-semibold">{{ value }}</dd>
                        </div>
                    </dl>
                    <p v-if="preview.adjustedCount > 0" role="alert" class="rounded-lg border border-warning/30 bg-warning/10 p-3 text-warning">
                        {{ t('debts.schedule.adjustedWarning', { count: preview.adjustedCount }) }}
                    </p>
                    <p v-if="isNothingLeft(preview)">{{ t('debts.schedule.nothingLeft') }}</p>
                    <fieldset v-else :disabled="saving || locked" class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label for="debt-recalculate-count" class="mb-1 block text-sm font-medium">{{ t('debts.fields.installmentCount') }} *</label>
                            <input id="debt-recalculate-count" v-model.trim="form.installmentCount" type="text" inputmode="numeric" class="form-input" />
                            <p class="mt-1 text-sm text-gray-500">{{ t('debts.schedule.countHint') }}</p>
                            <p v-if="warningKey" role="status" class="mt-1 text-sm text-warning">{{ t(warningKey) }}</p>
                        </div>
                        <div>
                            <label for="debt-recalculate-next-due-date" class="mb-1 block text-sm font-medium">{{ t('debts.fields.nextDueDate') }} *</label>
                            <input id="debt-recalculate-next-due-date" v-model="form.nextDueDate" type="date" class="form-input" />
                        </div>
                    </fieldset>
                </template>

                <div class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <button type="button" class="btn btn-outline-secondary" @click="closeModal">{{ closeLabel }}</button>
                    <button type="submit" class="btn btn-primary" :disabled="saving || locked || !ready">{{ saving ? t('common.saving') : t('common.save') }}</button>
                </div>
            </form>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useDebtDialog } from '~/composables/useDebtDialog'
import { useDebts } from '~/composables/useDebts'
import type { ApiError } from '~/types/api'
import type { Debt, DebtDisplayError } from '~/types/debt'
import type { DebtRecalculationForm, DebtRecalculationPreview } from '~/types/debt-schedule'
import { formatDebtAmount, isUnknownOutcome } from '~/utils/debt-formatters'
import { debtRecalculationError, isNothingLeft, readInstallmentCount, toRecalculationForm } from '~/utils/debt-schedule-rules'
import { formatNumber } from '~/utils/display-format'
import { errorMessage } from '~/utils/expected-transaction-formatters'

// Replaces the installments that are not processed yet, after showing what is replaced. The page unmounts it when the session
// changes.
const props = defineProps<{ debt: Debt }>()
const emit = defineEmits<{
    close: []
    saved: []
}>()

const { previewRecalculation, recalculateSchedule } = useDebts()
const { t } = useI18n()
// Only the preview is aborted: a pending command may still commit on the server.
const closeModal = (): void => emit('close')
const { dialog, isCurrent } = useDebtDialog(closeModal)
const preview = ref<DebtRecalculationPreview | null>(null)
const previewing = ref(true)
const previewError = ref<DebtDisplayError | null>(null)
const form = reactive<DebtRecalculationForm>({ installmentCount: '', nextDueDate: '' })
const saving = ref(false)
// Nothing is sent again when the schedule may be replaced already.
const locked = ref(false)
const invalidKey = ref<string | null>(null)
const saveError = ref<DebtDisplayError | null>(null)
const readController = new AbortController()

// A frontend message carries messageKey; a backend message is shown verbatim.
const displayText = (error: DebtDisplayError): string => (error.messageKey ? t(error.messageKey, error.messageParams ?? {}) : error.message)
const errorText = computed(() => {
    if (invalidKey.value) return t(invalidKey.value)
    return saveError.value ? t('debts.schedule.saveFailed', { error: displayText(saveError.value) }) : ''
})
const closeLabel = computed(() => (saving.value ? t('expected.modal.closeWhileSaving') : t('common.close')))
const ready = computed(() => !!preview.value && !previewing.value && !previewError.value)
const warningKey = computed(() => readInstallmentCount(form.installmentCount).warningKey)
const facts = computed((): Array<[string, string]> => preview.value ? [
    ['debts.schedule.balance', formatDebtAmount(preview.value.balance)],
    ['debts.schedule.pendingPrincipal', formatDebtAmount(preview.value.pendingPrincipal)],
    ['debts.schedule.replacedCount', formatNumber(preview.value.replacedCount)]
] : [])

// A field that still holds the old default follows the new one; what the owner typed stays.
const startFrom = (fresh: DebtRecalculationPreview): void => {
    const before = preview.value ? toRecalculationForm(preview.value) : form
    const defaults = toRecalculationForm(fresh)
    if (form.installmentCount === before.installmentCount) form.installmentCount = defaults.installmentCount
    if (form.nextDueDate === before.nextDueDate) form.nextDueDate = defaults.nextDueDate
    preview.value = fresh
}

const loadPreview = async (): Promise<void> => {
    previewing.value = true
    previewError.value = null
    try {
        const fresh = await previewRecalculation(props.debt.id, readController.signal)
        if (isCurrent()) startFrom(fresh)
    } catch (error) {
        if (isCurrent()) previewError.value = errorMessage(error, 'common.errors.loadFailed')
    } finally {
        if (isCurrent()) previewing.value = false
    }
}

const submit = async (): Promise<void> => {
    const seen = preview.value
    if (saving.value || locked.value || !ready.value || !seen || !isCurrent()) return
    saveError.value = null
    invalidKey.value = debtRecalculationError(form, seen)
    if (invalidKey.value) return
    // The fields are disabled while saving; the focus stays in the dialog so that its keys keep working.
    dialog.value?.focus()
    saving.value = true
    try {
        await recalculateSchedule(props.debt.id, form, seen)
        if (isCurrent()) emit('saved')
    } catch (error) {
        if (!isCurrent()) return
        saveError.value = errorMessage(error, 'debts.errors.checkAndRetry')
        locked.value = isUnknownOutcome(error)
        saving.value = false
        // The schedule or the debt is no longer as it was previewed.
        if ((error as Partial<ApiError> | null)?.statusCode === 409) await loadPreview()
    }
}

onMounted(loadPreview)
onBeforeUnmount(() => readController.abort())
</script>

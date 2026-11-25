<template>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="closeModal">
        <section
            ref="dialog"
            role="dialog"
            aria-modal="true"
            :aria-label="t('debts.schedule.adjust')"
            tabindex="-1"
            class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl outline-none dark:bg-[#0e1726]"
        >
            <div class="flex items-center justify-between gap-4 border-b border-gray-200 p-5 dark:border-gray-700">
                <h2 class="text-lg font-semibold">{{ t('debts.schedule.adjust') }}</h2>
                <button type="button" class="btn btn-sm btn-outline-secondary" @click="closeModal">{{ closeLabel }}</button>
            </div>

            <form class="space-y-5 p-5" novalidate @submit.prevent="submit">
                <div v-if="errorText" role="alert" class="rounded-lg border border-danger/20 bg-danger/10 p-3 text-danger">
                    <p>{{ errorText }}</p>
                    <p v-if="unknown" class="mt-2 text-sm">{{ t('debts.schedule.unknown') }}</p>
                </div>

                <p>{{ t('debts.schedule.installment', { no: installment.installmentNo, date: formatDate(installment.dueDate) }) }}</p>

                <fieldset :disabled="saving || locked" class="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label for="debt-installment-principal" class="mb-1 block text-sm font-medium">{{ t('debts.fields.principal') }} *</label>
                        <input id="debt-installment-principal" v-model.trim="form.principal" type="text" inputmode="decimal" class="form-input" />
                        <p class="mt-1 text-sm text-gray-500">{{ t('debts.form.amountHint') }}</p>
                    </div>
                    <div>
                        <label for="debt-installment-interest" class="mb-1 block text-sm font-medium">{{ t('debts.fields.interest') }} *</label>
                        <input id="debt-installment-interest" v-model.trim="form.interest" type="text" inputmode="decimal" class="form-input" />
                    </div>
                    <div class="sm:col-span-2">
                        <label for="debt-installment-reason" class="mb-1 block text-sm font-medium">{{ t('expected.modal.adjustReason') }} *</label>
                        <textarea id="debt-installment-reason" v-model="form.reason" rows="3" maxlength="500" class="form-textarea"></textarea>
                        <p class="mt-1 text-sm text-gray-500">{{ t('expected.modal.reasonHint') }}</p>
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
import { computed, reactive, ref } from 'vue'
import { useDebtDialog } from '~/composables/useDebtDialog'
import { useDebts } from '~/composables/useDebts'
import type { ApiError } from '~/types/api'
import type { Debt, DebtDisplayError } from '~/types/debt'
import type { DebtInstallment, DebtInstallmentForm } from '~/types/debt-schedule'
import { isUnknownOutcome } from '~/utils/debt-formatters'
import { debtInstallmentError, toInstallmentForm } from '~/utils/debt-schedule-rules'
import { formatDate } from '~/utils/display-format'
import { errorMessage } from '~/utils/expected-transaction-formatters'

// Changes the expected amounts of one open installment. The page unmounts it when the session changes.
const props = defineProps<{ debt: Debt; installment: DebtInstallment }>()
const emit = defineEmits<{
    close: []
    saved: []
}>()

const { adjustInstallment } = useDebts()
const { t } = useI18n()
// Closing is not a rollback: a pending command may still commit on the server.
const closeModal = (): void => emit('close')
const { dialog, isCurrent } = useDebtDialog(closeModal)
const form = reactive<DebtInstallmentForm>(toInstallmentForm(props.installment))
const saving = ref(false)
// Nothing is sent again when the change may be saved already, or when the installment is no longer as this dialog was opened for.
const locked = ref(false)
const unknown = ref(false)
const invalidKey = ref<string | null>(null)
const saveError = ref<DebtDisplayError | null>(null)

// A frontend message carries messageKey; a backend message is shown verbatim.
const displayText = (error: DebtDisplayError): string => (error.messageKey ? t(error.messageKey, error.messageParams ?? {}) : error.message)
const errorText = computed(() => {
    if (invalidKey.value) return t(invalidKey.value)
    return saveError.value ? t('debts.schedule.saveFailed', { error: displayText(saveError.value) }) : ''
})
const closeLabel = computed(() => (saving.value ? t('expected.modal.closeWhileSaving') : t('common.close')))

const submit = async (): Promise<void> => {
    if (saving.value || locked.value || !isCurrent()) return
    saveError.value = null
    invalidKey.value = debtInstallmentError(form)
    if (invalidKey.value) return
    // The fields are disabled while saving; the focus stays in the dialog so that its keys keep working.
    dialog.value?.focus()
    saving.value = true
    try {
        await adjustInstallment(props.debt.id, props.installment.id, form)
        if (isCurrent()) emit('saved')
    } catch (error) {
        if (!isCurrent()) return
        saveError.value = errorMessage(error, 'debts.errors.checkAndRetry')
        unknown.value = isUnknownOutcome(error)
        locked.value = unknown.value || (error as Partial<ApiError> | null)?.statusCode === 409
        saving.value = false
    }
}
</script>

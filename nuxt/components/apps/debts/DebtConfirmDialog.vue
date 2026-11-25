<template>
    <slot />
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'
import { onBeforeUnmount, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import type { DebtDialog } from '~/types/debt'

// Renders nothing itself: the screen calls confirm() through a template ref.
const auth = useAuthStore()
const { t } = useI18n()
let open = false

// User data only goes through titleText and text, which are not rendered as HTML.
const confirm = async (dialog: DebtDialog): Promise<boolean> => {
    open = true
    const answer = await Swal.fire({
        titleText: t(dialog.titleKey, dialog.titleParams),
        text: t(dialog.textKey, dialog.textParams),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: t(dialog.confirmKey),
        cancelButtonText: t('common.back')
    })
    open = false
    return answer.isConfirmed
}

// A dialog of the old session must not stay open; closing answers it as not confirmed.
const dismiss = (): void => {
    if (open) Swal.close()
}

watch(() => [auth.token, auth.isAuthenticated], dismiss, { flush: 'sync' })
onBeforeUnmount(dismiss)

defineExpose({ confirm })
</script>

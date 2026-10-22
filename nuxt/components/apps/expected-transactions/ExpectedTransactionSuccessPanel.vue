<template>
    <section role="status" aria-live="polite" class="panel border border-success/30 bg-success/10">
        <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 space-y-2">
                <h2 class="font-semibold text-success">{{ successMessage(payload.mode) }}</h2>
                <p class="break-all text-sm">Mã kỳ: {{ payload.expectedTransactionId }}</p>
                <div v-if="payload.payment" class="space-y-1">
                    <p class="break-all"><strong>Mã giao dịch thực đã lưu:</strong> {{ payload.payment.actualTransactionId }}</p>
                    <p><strong>Ngày giao dịch:</strong> {{ formatDate(payload.payment.actualTransaction.transactionDate) }}</p>
                    <p v-if="payload.payment.actualTransaction.revenueAmount > 0">
                        <strong>Số tiền thu:</strong> {{ formatCurrency(payload.payment.actualTransaction.revenueAmount) }}
                    </p>
                    <p v-if="payload.payment.actualTransaction.spentAmount > 0">
                        <strong>Số tiền chi:</strong> {{ formatCurrency(payload.payment.actualTransaction.spentAmount) }}
                    </p>
                    <p class="text-sm">Ghi nhận không cập nhật số dư tài khoản.</p>
                </div>
                <p class="text-sm">Kết quả đã được lưu. Việc tải lại danh sách không thay đổi kết quả này.</p>
            </div>
            <button type="button" class="btn btn-sm btn-outline-success shrink-0" @click="emit('dismiss')">Đóng thông báo</button>
        </div>
    </section>
</template>

<script setup lang="ts">
import type { ActionMode, CommittedPayload } from '~/types/recurring-transaction'
import { formatCurrency, formatDate } from '~/utils/expected-transaction-formatters'

defineProps<{ payload: CommittedPayload }>()
const emit = defineEmits<{ dismiss: [] }>()

const successMessage = (mode: ActionMode): string => {
    switch (mode) {
        case 'payment': return 'Đã ghi nhận thanh toán và lưu giao dịch thực.'
        case 'link': return 'Đã liên kết giao dịch có sẵn với kỳ.'
        case 'cancel': return 'Đã hủy kỳ.'
        case 'adjust': return 'Đã điều chỉnh số tiền của kỳ.'
    }
}
</script>

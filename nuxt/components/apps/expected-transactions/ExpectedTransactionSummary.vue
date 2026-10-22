<template>
    <div class="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
        <h3 class="font-semibold">{{ templateLabel(transaction) }}</h3>
        <p v-if="transaction.description" class="mt-1 whitespace-pre-wrap text-sm">{{ transaction.description }}</p>
        <p class="mt-2 break-all text-xs text-gray-500">Mã kỳ: {{ transaction.id }}</p>
        <p class="mt-1 text-sm">Trạng thái: {{ statusLabel(transaction.displayStatus) }}</p>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <p><strong>Số tiền hiện hành:</strong> {{ formatCurrency(transaction.expectedAmount) }}</p>
            <p><strong>Số tiền gốc:</strong> {{ formatCurrency(transaction.originalAmount ?? transaction.expectedAmount) }}</p>
            <p><strong>Ngày dự kiến:</strong> {{ formatDate(transaction.expectedDate) }}</p>
            <p><strong>Loại:</strong> {{ typeLabel(transaction.transactionType) }}</p>
        </div>
        <p v-if="transaction.isAdjusted" class="mt-2 text-sm text-warning">Đã điều chỉnh; số tiền gốc luôn là số tiền trước lần chỉnh đầu tiên.</p>
        <p v-if="transaction.adjustmentReason" class="mt-2 whitespace-pre-wrap text-sm">Lý do đã lưu: {{ transaction.adjustmentReason }}</p>
        <p v-if="transaction.processedAt" class="mt-2 text-sm">Thời điểm xử lý: {{ formatTimestamp(transaction.processedAt) }}</p>
        <p v-if="transaction.actualTransactionId" class="mt-1 break-all text-sm">Giao dịch thực đã liên kết: {{ transaction.actualTransactionId }}</p>
    </div>
</template>

<script setup lang="ts">
import type { ExpectedTransactionViewModel } from '~/types/recurring-transaction'
import { formatCurrency, formatDate, formatTimestamp, statusLabel, templateLabel, typeLabel } from '~/utils/expected-transaction-formatters'

defineProps<{ transaction: ExpectedTransactionViewModel }>()
</script>

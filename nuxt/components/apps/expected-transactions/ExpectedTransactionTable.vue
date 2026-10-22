<template>
    <section class="panel" :aria-busy="loading">
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-lg font-semibold">Danh sách kỳ</h2>
            <button type="button" class="btn btn-sm btn-outline-primary" :disabled="loading || !authenticated" @click="emit('reload')">Tải lại danh sách</button>
        </div>
        <p class="mb-4 text-sm text-gray-500">
            Ghi nhận không cập nhật số dư tài khoản và không thực hiện thanh toán hộ bạn.
            Nếu đóng hộp thoại khi đang gửi, yêu cầu vẫn có thể được lưu; hãy tải lại danh sách trước khi thao tác lại.
        </p>

        <div v-if="loading" role="status" class="py-12 text-center text-gray-500">Đang tải giao dịch dự kiến...</div>
        <div v-else-if="listError" role="alert" class="rounded-lg border border-danger/20 bg-danger/10 p-4 text-danger">
            <p v-if="listErrorAfterCommit">Thao tác đã thành công, nhưng không thể tải lại danh sách: {{ listError }}</p>
            <p v-else>Không thể tải danh sách giao dịch dự kiến: {{ listError }}</p>
            <button type="button" class="btn btn-sm btn-outline-primary mt-3" @click="emit('reload')">Thử tải lại danh sách</button>
        </div>
        <p v-else-if="!authenticated" class="py-12 text-center text-gray-500">Vui lòng đăng nhập để xem giao dịch dự kiến.</p>
        <p v-else-if="dateRangeError" class="py-12 text-center text-gray-500">Khoảng ngày không hợp lệ. Hãy sửa bộ lọc ngày để xem danh sách.</p>
        <p v-else-if="transactions.length === 0" class="py-12 text-center text-gray-500">Không có giao dịch dự kiến phù hợp với bộ lọc.</p>
        <div v-else class="table-responsive">
            <table class="table-hover">
                <thead>
                    <tr>
                        <th>Kỳ / Mẫu định kỳ</th>
                        <th>Ngày dự kiến</th>
                        <th>Tài khoản / Loại</th>
                        <th>Số tiền</th>
                        <th>Trạng thái</th>
                        <th>Thông tin xử lý</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="transaction in transactions" :key="transaction.id" :class="{ 'bg-primary/10': highlightedId === transaction.id }">
                        <td class="min-w-[180px] max-w-xs">
                            <p class="font-semibold">{{ templateLabel(transaction) }}</p>
                            <p v-if="transaction.description" class="mt-1 whitespace-pre-wrap text-sm">{{ transaction.description }}</p>
                            <p v-if="transaction.category" class="mt-1 text-xs text-gray-500">Danh mục: {{ transaction.category }}</p>
                            <p class="mt-1 break-all text-xs text-gray-500">Mã kỳ: {{ transaction.id }}</p>
                        </td>
                        <td class="whitespace-nowrap">
                            <p>{{ formatDate(transaction.expectedDate) }}</p>
                            <p v-if="isPending(transaction)" class="mt-1 text-xs" :class="transaction.daysUntilDue < 0 ? 'text-danger' : 'text-gray-500'">
                                {{ dueMessage(transaction.daysUntilDue) }}
                            </p>
                        </td>
                        <td>
                            <p>{{ transaction.accountName || (transaction.accountId ? 'Tài khoản không khả dụng' : 'Chưa gắn tài khoản') }}</p>
                            <p class="mt-1 text-sm text-gray-500">{{ typeLabel(transaction.transactionType) }}</p>
                        </td>
                        <td class="whitespace-nowrap">
                            <p class="font-semibold">{{ formatCurrency(transaction.expectedAmount) }}</p>
                            <p v-if="transaction.isAdjusted" class="mt-1 text-xs text-warning">Đã điều chỉnh</p>
                            <p v-if="transaction.originalAmount != null" class="mt-1 text-xs text-gray-500">Số tiền gốc: {{ formatCurrency(transaction.originalAmount) }}</p>
                        </td>
                        <td>
                            <span class="badge" :class="statusClass(transaction.displayStatus)">{{ statusLabel(transaction.displayStatus) }}</span>
                        </td>
                        <td class="min-w-[180px] max-w-xs text-sm">
                            <p>Sinh kỳ: {{ formatTimestamp(transaction.generatedAt) }}</p>
                            <p class="mt-1">Xử lý: {{ transaction.processedAt ? formatTimestamp(transaction.processedAt) : 'Chưa xử lý' }}</p>
                            <p v-if="transaction.actualTransactionId" class="mt-1 break-all">Giao dịch thực: {{ transaction.actualTransactionId }}</p>
                            <p v-if="transaction.adjustmentReason" class="mt-1 whitespace-pre-wrap">Lý do: {{ transaction.adjustmentReason }}</p>
                            <p v-if="transaction.notes" class="mt-1 whitespace-pre-wrap text-gray-500">Ghi chú: {{ transaction.notes }}</p>
                        </td>
                        <td class="min-w-[220px]">
                            <div v-if="isPending(transaction)" class="flex flex-wrap gap-2">
                                <button v-if="isIncomeExpense(transaction)" type="button" class="btn btn-sm btn-outline-success" @click="emit('open', transaction, 'payment')">Ghi nhận thanh toán</button>
                                <button type="button" class="btn btn-sm btn-outline-primary" @click="emit('open', transaction, 'link')">Liên kết giao dịch có sẵn</button>
                                <button v-if="isIncomeExpense(transaction)" type="button" class="btn btn-sm btn-outline-warning" @click="emit('open', transaction, 'adjust')">Chỉnh số tiền</button>
                                <button type="button" class="btn btn-sm btn-outline-danger" @click="emit('open', transaction, 'cancel')">Hủy kỳ</button>
                            </div>
                            <p v-else class="text-sm text-gray-500">Kỳ đã xử lý, không thể thay đổi.</p>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="!loading && !listError && !dateRangeError && pagination.totalRow > 0" class="mt-5 flex flex-wrap items-center justify-between gap-4">
            <p class="text-sm text-gray-500">Hiển thị {{ firstRow }}–{{ lastRow }} trong {{ pagination.totalRow }} kỳ</p>
            <div class="flex items-center gap-2">
                <button type="button" class="btn btn-sm btn-outline-primary" :disabled="pagination.pageIndex <= 1" @click="emit('change-page', pagination.pageIndex - 1)">Trước</button>
                <span class="text-sm">Trang {{ pagination.pageIndex }} / {{ pagination.pageCount }}</span>
                <button type="button" class="btn btn-sm btn-outline-primary" :disabled="pagination.pageIndex >= pagination.pageCount" @click="emit('change-page', pagination.pageIndex + 1)">Sau</button>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Pagination } from '~/types/api'
import type { ActionMode, ExpectedTransactionViewModel } from '~/types/recurring-transaction'
import {
    dueMessage,
    formatCurrency,
    formatDate,
    formatTimestamp,
    isIncomeExpense,
    isPending,
    statusClass,
    statusLabel,
    templateLabel,
    typeLabel
} from '~/utils/expected-transaction-formatters'

// Presentational: the page owns loading, paging requests and the action guard behind 'open'.
const props = defineProps<{
    transactions: ExpectedTransactionViewModel[]
    pagination: Pagination
    loading: boolean
    listError: string | null
    listErrorAfterCommit: boolean
    authenticated: boolean
    dateRangeError: string | null
    highlightedId: string | null
}>()
const emit = defineEmits<{
    open: [transaction: ExpectedTransactionViewModel, mode: ActionMode]
    'change-page': [page: number]
    reload: []
}>()

const firstRow = computed(() => (props.pagination.pageIndex - 1) * props.pagination.pageSize + 1)
const lastRow = computed(() => Math.min(props.pagination.pageIndex * props.pagination.pageSize, props.pagination.totalRow))
</script>

<template>
    <div class="grid gap-4 sm:grid-cols-2">
        <div>
            <label for="payment-amount" class="mb-1 block text-sm font-medium">Số tiền thanh toán (cố định)</label>
            <input id="payment-amount" type="text" class="form-input bg-gray-100 dark:bg-gray-800" :value="formatCurrency(transaction.expectedAmount)" readonly />
        </div>
        <div>
            <label for="payment-date" class="mb-1 block text-sm font-medium">Ngày giao dịch (cố định)</label>
            <input id="payment-date" type="text" class="form-input bg-gray-100 dark:bg-gray-800" :value="formatDate(transaction.expectedDate)" readonly />
        </div>
    </div>
    <p class="text-sm text-gray-500">Số tiền và ngày lấy từ kỳ. Muốn đổi số tiền, hãy đóng hộp thoại và chọn “Chỉnh số tiền” trước.</p>
    <div>
        <template v-if="transaction.accountId">
            <label for="payment-bound-account" class="mb-1 block text-sm font-medium">Tài khoản đã gắn với kỳ (không thể thay đổi)</label>
            <input id="payment-bound-account" type="text" class="form-input bg-gray-100 dark:bg-gray-800" :value="boundAccountLabel" readonly />
        </template>
        <template v-else>
            <label for="payment-account" class="mb-1 block text-sm font-medium">Tài khoản nhận giao dịch *</label>
            <select id="payment-account" v-model="accountId" class="form-select" :disabled="selectDisabled" required>
                <option value="">Chọn tài khoản của bạn</option>
                <option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name || 'Tài khoản chưa có tên' }}</option>
            </select>
            <p class="mt-1 text-sm text-gray-500">Lựa chọn này chỉ dùng cho giao dịch thực, không sửa tài khoản của kỳ gốc.</p>
        </template>
        <p v-if="accountsLoading" role="status" class="mt-2 text-sm text-gray-500">Đang tải tài khoản...</p>
        <div v-else-if="accountError" role="alert" class="mt-2 text-sm text-danger">
            <p>Không thể tải tài khoản: {{ accountError }}</p>
            <button type="button" class="btn btn-sm btn-outline-primary mt-2" :disabled="saving" @click="emit('retry')">Thử tải lại tài khoản</button>
        </div>
        <p v-else-if="accounts.length === 0" role="alert" class="mt-2 text-sm text-warning">Chưa có tài khoản của bạn để ghi nhận. Hãy tạo tài khoản trước khi tiếp tục.</p>
        <p v-else-if="transaction.accountId && !paymentAccountAvailable" role="alert" class="mt-2 text-sm text-warning">Tài khoản đã gắn không còn khả dụng. Không thể thay bằng tài khoản khác trong thao tác ghi nhận.</p>
    </div>
    <p class="rounded-lg bg-info/10 p-3 text-sm text-info">Ghi nhận không cập nhật số dư tài khoản và không thực hiện thanh toán hộ bạn. Hệ thống lưu giao dịch thực và xác nhận kỳ trong một yêu cầu.</p>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AccountSelection } from '~/types/account'
import type { ExpectedTransactionViewModel } from '~/types/recurring-transaction'
import { formatCurrency, formatDate } from '~/utils/expected-transaction-formatters'

// Presentational: the modal owns the account read, the selection and every lock that feeds selectDisabled.
const props = defineProps<{
    transaction: ExpectedTransactionViewModel
    accounts: ReadonlyArray<Readonly<AccountSelection>>
    accountsLoading: boolean
    accountError: string | null
    paymentAccountAvailable: boolean
    selectDisabled: boolean
    saving: boolean
    modelValue: string
}>()
const emit = defineEmits<{
    'update:modelValue': [accountId: string]
    retry: []
}>()

const accountId = computed({
    get: () => props.modelValue,
    set: value => emit('update:modelValue', value)
})
const boundAccountLabel = computed(() => {
    const transaction = props.transaction
    if (!transaction.accountId) return 'Chưa gắn tài khoản'
    return transaction.accountName || props.accounts.find(account => account.id === transaction.accountId)?.name || 'Tài khoản không khả dụng'
})
</script>

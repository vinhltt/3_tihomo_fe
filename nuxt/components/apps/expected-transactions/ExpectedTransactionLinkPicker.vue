<template>
    <div>
        <label for="actual-search" class="mb-1 block text-sm font-medium">Tìm giao dịch có sẵn</label>
        <input id="actual-search" v-model="search" type="search" class="form-input" placeholder="Tìm theo mô tả hoặc danh mục" :disabled="saving" />
        <p class="mt-1 text-sm text-gray-500">Chọn một giao dịch của bạn. Liên kết không tạo thêm giao dịch; máy chủ kiểm tra giao dịch chưa gắn với kỳ khác.</p>
    </div>
    <div :aria-busy="loading">
        <p v-if="loading" role="status" class="py-6 text-center text-gray-500">Đang tải giao dịch có sẵn...</p>
        <div v-else-if="error" role="alert" class="rounded-lg bg-danger/10 p-3 text-danger">
            <p>Không thể tải giao dịch: {{ error }}</p>
            <button type="button" class="btn btn-sm btn-outline-primary mt-2" :disabled="saving" @click="load()">Thử tải lại giao dịch</button>
        </div>
        <p v-else-if="rows.length === 0" class="py-6 text-center text-gray-500">Không có giao dịch phù hợp để lựa chọn.</p>
        <div v-else class="table-responsive">
            <table class="table-hover">
                <thead>
                    <tr><th>Chọn</th><th>Ngày</th><th>Mô tả / Mã</th><th>Thu</th><th>Chi</th></tr>
                </thead>
                <tbody>
                    <tr v-for="actual in rows" :key="actual.id" :class="selected?.id === actual.id ? 'bg-primary/10' : ''">
                        <td>
                            <input
                                type="radio"
                                name="actual-transaction"
                                class="form-radio"
                                :checked="selected?.id === actual.id"
                                :aria-label="`Chọn giao dịch ${actual.id}`"
                                :disabled="saving || conflictBlocked"
                                @change="emit('selected', actual)"
                            />
                        </td>
                        <td class="whitespace-nowrap">{{ formatDate(actual.transactionDate) }}</td>
                        <td class="max-w-xs">
                            <p>{{ actual.description || 'Không có mô tả' }}</p>
                            <p v-if="actual.categorySummary" class="mt-1 text-xs text-gray-500">{{ actual.categorySummary }}</p>
                            <p class="mt-1 break-all text-xs text-gray-500">{{ actual.id }}</p>
                        </td>
                        <td class="whitespace-nowrap text-success">{{ formatCurrency(actual.revenueAmount) }}</td>
                        <td class="whitespace-nowrap text-danger">{{ formatCurrency(actual.spentAmount) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div v-if="!loading && !error && pagination.totalRow > 0" class="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>Hiển thị {{ firstRow }}–{{ lastRow }} trong {{ pagination.totalRow }} giao dịch</p>
            <div class="flex items-center gap-2">
                <button type="button" class="btn btn-sm btn-outline-primary" :disabled="saving || pagination.pageIndex <= 1" @click="load(pagination.pageIndex - 1)">Trước</button>
                <span>Trang {{ pagination.pageIndex }} / {{ pagination.pageCount }}</span>
                <button type="button" class="btn btn-sm btn-outline-primary" :disabled="saving || pagination.pageIndex >= pagination.pageCount" @click="load(pagination.pageIndex + 1)">Sau</button>
            </div>
        </div>
    </div>
    <div v-if="selected" class="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
        <p class="break-all font-semibold">Giao dịch đã chọn: {{ selected.id }}</p>
        <p class="mt-1">Ngày: {{ formatDate(selected.transactionDate) }}</p>
        <p class="mt-1">Thu: {{ formatCurrency(selected.revenueAmount) }} · Chi: {{ formatCurrency(selected.spentAmount) }}</p>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTransactions } from '~/composables/useTransactions'
import type { Pagination } from '~/types/api'
import type { TransactionViewModel } from '~/types/transaction'
import { errorMessage, formatCurrency, formatDate } from '~/utils/expected-transaction-formatters'

// Owns the actual-transaction read. The modal mounts it only for a current session and owns the selection and submit.
const props = defineProps<{ sessionKey: number; saving: boolean; conflictBlocked: boolean; selected: TransactionViewModel | null }>()
const emit = defineEmits<{
    selected: [actual: TransactionViewModel | null]
    // Loading or failed reads block submit even when a selection from another page is kept.
    blocked: [blocked: boolean]
}>()

const { searchTransactions } = useTransactions()
const emptyPagination = (): Pagination => ({ pageIndex: 1, pageSize: 10, totalRow: 0, pageCount: 0 })
const search = ref('')
const rows = ref<TransactionViewModel[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const pagination = ref<Pagination>(emptyPagination())
let disposed = false
let sequence = 0
let controller: AbortController | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null

const firstRow = computed(() => (pagination.value.pageIndex - 1) * pagination.value.pageSize + 1)
const lastRow = computed(() => Math.min(pagination.value.pageIndex * pagination.value.pageSize, pagination.value.totalRow))

const invalidate = (): void => {
    sequence += 1
    controller?.abort()
    controller = null
    if (searchTimer !== null) clearTimeout(searchTimer)
    searchTimer = null
}

const load = async (page = pagination.value.pageIndex): Promise<void> => {
    invalidate()
    if (disposed) return
    const requestSequence = sequence
    const requestKey = props.sessionKey
    const requestController = new AbortController()
    controller = requestController
    const isCurrent = () => !disposed && props.sessionKey === requestKey && requestSequence === sequence && !requestController.signal.aborted
    const pageCount = pagination.value.pageCount
    const pageIndex = pageCount > 0 ? Math.min(Math.max(page, 1), pageCount) : 1
    loading.value = true
    error.value = null
    try {
        const response = await searchTransactions(search.value.trim(), pageIndex, pagination.value.pageSize, requestController.signal)
        if (!isCurrent()) return
        rows.value = response.data
        pagination.value = response.pagination
    } catch (err) {
        if (isCurrent()) error.value = errorMessage(err, 'Vui lòng thử tải lại giao dịch.')
    } finally {
        if (isCurrent()) {
            loading.value = false
            controller = null
        }
    }
}

watch(() => loading.value || !!error.value, blocked => emit('blocked', blocked), { flush: 'sync' })
watch(() => props.sessionKey, invalidate, { flush: 'sync' })
watch(search, () => {
    if (disposed) return
    invalidate()
    rows.value = []
    emit('selected', null)
    error.value = null
    pagination.value = { ...emptyPagination(), pageSize: pagination.value.pageSize }
    loading.value = true
    searchTimer = setTimeout(() => {
        searchTimer = null
        void load(1)
    }, 300)
}, { flush: 'sync' })

onMounted(() => {
    void load(1)
})
onBeforeUnmount(() => {
    disposed = true
    invalidate()
})
</script>

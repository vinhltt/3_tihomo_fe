<template>
    <section class="panel">
        <h2 class="mb-4 text-lg font-semibold">Bộ lọc</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div>
                <label for="expected-status" class="mb-1 block text-sm font-medium">Trạng thái</label>
                <select id="expected-status" v-model="displayStatus" class="form-select">
                    <option value="">Tất cả trạng thái</option>
                    <option :value="ExpectedTransactionDisplayStatus.Pending">Chờ xử lý</option>
                    <option :value="ExpectedTransactionDisplayStatus.Overdue">Quá hạn</option>
                    <option :value="ExpectedTransactionDisplayStatus.Confirmed">Đã xác nhận</option>
                    <option :value="ExpectedTransactionDisplayStatus.Cancelled">Đã hủy</option>
                    <option :value="ExpectedTransactionDisplayStatus.Completed">Hoàn thành</option>
                </select>
            </div>
            <div>
                <label for="expected-from-date" class="mb-1 block text-sm font-medium">Từ ngày</label>
                <input id="expected-from-date" v-model="dateFrom" type="date" class="form-input" />
            </div>
            <div>
                <label for="expected-to-date" class="mb-1 block text-sm font-medium">Đến ngày</label>
                <input id="expected-to-date" v-model="dateTo" type="date" class="form-input" />
            </div>
            <div>
                <label for="expected-template" class="mb-1 block text-sm font-medium">Mẫu định kỳ</label>
                <select id="expected-template" v-model="templateId" class="form-select" :disabled="templatesLoading || !!templatesError">
                    <option value="">Tất cả mẫu</option>
                    <option v-for="option in templateOptions" :key="option.id" :value="option.id">{{ option.name || 'Mẫu chưa có tên' }}</option>
                </select>
                <p v-if="templatesLoading" role="status" class="mt-1 text-sm text-gray-500">Đang tải mẫu định kỳ...</p>
                <p v-else-if="!templatesError && templateOptions.length === 0" class="mt-1 text-sm text-gray-500">Chưa có mẫu định kỳ.</p>
            </div>
            <div class="flex items-end">
                <button type="button" class="btn btn-outline-secondary w-full" @click="emit('reset')">Đặt lại bộ lọc</button>
            </div>
        </div>
        <p v-if="dateRangeError" role="alert" class="mt-4 rounded-lg border border-danger/20 bg-danger/10 p-3 text-danger">{{ dateRangeError }}</p>
        <div v-if="templatesError" role="alert" class="mt-4 rounded-lg border border-danger/20 bg-danger/10 p-3 text-danger">
            <p>Không thể tải mẫu định kỳ: {{ templatesError }}</p>
            <button type="button" class="btn btn-sm btn-outline-primary mt-2" @click="emit('retry-templates')">Thử tải lại mẫu</button>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ExpectedTransactionDisplayStatus } from '~/types/recurring-transaction'
import type { ExpectedTransactionFilterForm, RecurringTransactionTemplateViewModel } from '~/types/recurring-transaction'

// Presentational: the page owns filter state, validation (dateRangeError) and every request.
const props = defineProps<{
    modelValue: ExpectedTransactionFilterForm
    templateOptions: Array<Pick<RecurringTransactionTemplateViewModel, 'id' | 'name'>>
    templatesLoading: boolean
    templatesError: string | null
    dateRangeError: string | null
}>()
const emit = defineEmits<{
    'update:modelValue': [filters: ExpectedTransactionFilterForm]
    reset: []
    'retry-templates': []
}>()

// Each edit emits a new form object; the page's watcher resets to page 1 and reloads once.
const field = <K extends keyof ExpectedTransactionFilterForm>(key: K) => computed({
    get: () => props.modelValue[key],
    set: (value: ExpectedTransactionFilterForm[K]) => emit('update:modelValue', { ...props.modelValue, [key]: value })
})
const displayStatus = field('displayStatus')
const dateFrom = field('dateFrom')
const dateTo = field('dateTo')
const templateId = field('templateId')
</script>

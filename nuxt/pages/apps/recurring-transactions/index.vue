<template>
    <div>
        <div class="panel">
            <div class="mb-5 flex items-center justify-between">
                <h5 class="text-lg font-semibold dark:text-white-light">{{ t('recurring.list.title') }}</h5>
                <button type="button" class="btn btn-primary" @click="openCreateModal">
                    <icon-plus class="w-5 h-5 ltr:mr-2 rtl:ml-2" />
                    {{ t('recurring.list.addNew') }}
                </button>
            </div>

            <p v-if="savedNotice" role="status" class="mb-5 rounded-lg bg-success/10 p-3 text-success">{{ t('recurring.list.saved') }}</p>
            <div v-if="accountError" role="alert" class="mb-5 rounded-lg border border-danger/20 bg-danger/10 p-3 text-danger">
                <p>{{ t('accounts.errors.loadFailedDetail', { error: accountErrorText }) }}</p>
                <button type="button" class="mt-2 btn btn-sm btn-outline-primary" @click="loadAccounts">{{ t('common.retry') }}</button>
            </div>

            <!-- Filters -->
            <div class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                    <label class="form-label">{{ t('transactions.fields.account') }}</label>
                    <select v-model="selectedAccountId" class="form-select" :disabled="accountsLoading || !!accountError" @change="handleAccountChange">
                        <option value="">{{ t('accounts.dropdown.allAccounts') }}</option>
                        <option v-for="account in accounts" :key="account.id" :value="account.id">
                            {{ account.name }}
                        </option>
                    </select>
                    <p v-if="accountsLoading" class="mt-1 text-sm text-gray-500">{{ t('accounts.dropdown.loading') }}</p>
                </div>
                <div>
                    <label class="form-label">{{ t('common.status') }}</label>
                    <select v-model="selectedStatus" class="form-select" @change="handleStatusChange">
                        <option value="">{{ t('common.all') }}</option>
                        <option value="active">{{ t('common.active') }}</option>
                        <option value="inactive">{{ t('common.inactive') }}</option>
                    </select>
                </div>
                <div>
                    <label class="form-label">{{ t('recurring.fields.frequency') }}</label>
                    <select v-model="selectedFrequency" class="form-select" @change="handleFrequencyChange">
                        <option value="">{{ t('recurring.filters.allFrequencies') }}</option>
                        <option :value="String(RecurrenceFrequency.Daily)">{{ t('enums.recurrenceFrequency.daily') }}</option>
                        <option :value="String(RecurrenceFrequency.Weekly)">{{ t('enums.recurrenceFrequency.weekly') }}</option>
                        <option :value="String(RecurrenceFrequency.Biweekly)">{{ t('enums.recurrenceFrequency.biweekly') }}</option>
                        <option :value="String(RecurrenceFrequency.Monthly)">{{ t('enums.recurrenceFrequency.monthly') }}</option>
                        <option :value="String(RecurrenceFrequency.Quarterly)">{{ t('enums.recurrenceFrequency.quarterly') }}</option>
                        <option :value="String(RecurrenceFrequency.SemiAnnually)">{{ t('enums.recurrenceFrequency.semiAnnually') }}</option>
                        <option :value="String(RecurrenceFrequency.Annually)">{{ t('enums.recurrenceFrequency.annually') }}</option>
                        <option :value="String(RecurrenceFrequency.Custom)">{{ t('enums.recurrenceFrequency.custom') }}</option>
                    </select>
                </div>
                <div class="flex items-end">
                    <button type="button" class="btn btn-secondary w-full" @click="resetFilters">
                        <icon-refresh class="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                        {{ t('common.reset') }}
                    </button>
                </div>
            </div>

            <!-- Templates Table -->
            <div class="table-responsive">
                <table class="table-hover">
                    <thead>
                        <tr>
                            <th>{{ t('recurring.fields.name') }}</th>
                            <th>{{ t('transactions.fields.account') }}</th>
                            <th>{{ t('transactions.fields.amount') }}</th>
                            <th>{{ t('recurring.fields.frequency') }}</th>
                            <th>{{ t('recurring.fields.nextExecutionDate') }}</th>
                            <th>{{ t('common.status') }}</th>
                            <th class="text-center">{{ t('common.actions') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loading">
                            <td colspan="7" class="text-center py-4">
                                <div class="inline-block animate-spin border-4 border-transparent border-l-primary rounded-full w-10 h-10"></div>
                            </td>
                        </tr>
                        <tr v-else-if="templatesError">
                            <td colspan="7" class="py-4">
                                <div role="alert" class="rounded-lg border border-danger/20 bg-danger/10 p-3 text-center text-danger">
                                    <p>{{ t('recurring.list.loadFailed', { error: templatesErrorText }) }}</p>
                                    <button type="button" class="mt-2 btn btn-sm btn-outline-primary" @click="getTemplates()">{{ t('common.retry') }}</button>
                                </div>
                            </td>
                        </tr>
                        <tr v-else-if="templates.length === 0">
                            <td colspan="7" class="text-center py-4 text-gray-500">
                                {{ t('recurring.list.empty') }}
                            </td>
                        </tr>
                        <tr v-else v-for="template in templates" :key="template.id">
                            <td>
                                <div>
                                    <div class="font-semibold">{{ template.name }}</div>
                                    <div class="text-xs text-gray-500">{{ template.description }}</div>
                                </div>
                            </td>
                            <td>{{ getAccountById(template.accountId)?.name || t('common.unknown') }}</td>
                            <td>
                                <span :class="template.transactionType === 0 ? 'text-success' : 'text-danger'">
                                    {{ template.transactionType === 0 ? '+' : '-' }}{{ formatMoney(template.amount) }}
                                </span>
                            </td>
                            <td>{{ getFrequencyText(template.frequency) }}</td>
                            <td>{{ formatDate(template.nextExecutionDate) }}</td>
                            <td>
                                <span :class="template.isActive ? 'badge badge-outline-success' : 'badge badge-outline-secondary'">
                                    {{ template.isActive ? t('common.active') : t('common.inactive') }}
                                </span>
                            </td>
                            <td class="text-center">
                                <div class="flex items-center justify-center gap-2">
                                    <button 
                                        type="button" 
                                        class="btn btn-sm btn-outline-primary"
                                        @click="viewTemplate(template)"
                                        :title="t('common.showDetails')"
                                    >
                                        <icon-eye class="w-4 h-4" />
                                    </button>
                                    <button 
                                        type="button" 
                                        class="btn btn-sm btn-outline-info"
                                        @click="editTemplate(template)"
                                        :title="t('common.edit')"
                                    >
                                        <icon-edit class="w-4 h-4" />
                                    </button>
                                    <button 
                                        type="button" 
                                        :class="template.isActive ? 'btn btn-sm btn-outline-warning' : 'btn btn-sm btn-outline-success'"
                                        @click="toggleTemplateStatus(template)"
                                        :title="template.isActive ? t('recurring.actions.pause') : t('recurring.actions.activate')"
                                    >
                                        <icon-pause v-if="template.isActive" class="w-4 h-4" />
                                        <icon-play v-else class="w-4 h-4" />
                                    </button>
                                    <button 
                                        type="button" 
                                        class="btn btn-sm btn-outline-danger"
                                        @click="deleteTemplate(template)"
                                        :title="t('common.delete')"
                                    >
                                        <icon-trash class="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            <div v-if="pagination.totalRow > 0" class="mt-5 flex items-center justify-between">
                <div class="text-sm text-gray-500">
                    {{ t('recurring.pagination.summary', {
                        from: (pagination.pageIndex - 1) * pagination.pageSize + 1,
                        to: Math.min(pagination.pageIndex * pagination.pageSize, pagination.totalRow),
                        total: pagination.totalRow
                    }) }}
                </div>
                <div class="flex items-center gap-2">
                    <button 
                        type="button" 
                        class="btn btn-sm btn-outline-primary"
                        :disabled="pagination.pageIndex <= 1"
                        @click="changePage(pagination.pageIndex - 1)"
                    >
                        {{ t('common.previous') }}
                    </button>
                    <span class="px-3 py-1 text-sm">
                        {{ t('transactions.pagination.page', { current: pagination.pageIndex, total: pagination.pageCount }) }}
                    </span>
                    <button 
                        type="button" 
                        class="btn btn-sm btn-outline-primary"
                        :disabled="pagination.pageIndex >= pagination.pageCount"
                        @click="changePage(pagination.pageIndex + 1)"
                    >
                        {{ t('common.next') }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Create/Edit Modal -->
        <RecurringTransactionModal
            v-if="showModal"
            :template="selectedTemplate"
            :accounts="accounts"
            :account-loading="accountsLoading"
            :account-error="accountError"
            @close="closeModal"
            @saved="handleTemplateSaved"
            @retry-accounts="loadAccounts"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import Swal from 'sweetalert2'
import { useRecurringTransactions } from '~/composables/useRecurringTransactions'
import { useAccountsSimple } from '~/composables/useAccountsSimple'
import type { RecurringTransactionTemplateViewModel } from '~/types'
import { RecurrenceFrequency } from '~/types'
import RecurringTransactionModal from '~/components/apps/recurring-transactions/RecurringTransactionModal.vue'
import { useAuthStore } from '~/stores/auth'
import { formatDate, formatMoney } from '~/utils/display-format'

// Icons
import IconPlus from '~/components/icon/icon-plus.vue'
import IconRefresh from '~/components/icon/icon-refresh.vue'
import IconEye from '~/components/icon/icon-eye.vue'
import IconEdit from '~/components/icon/icon-edit.vue'
import IconPause from '~/components/icon/icon-pause.vue'
import IconPlay from '~/components/icon/icon-play.vue'
import IconTrash from '~/components/icon/icon-trash.vue'

// Composables
const { 
    templates, 
    loading,
    error: templatesError,
    pagination,
    getTemplates,
    clearTemplates,
    toggleActiveStatus, 
    deleteTemplate: deleteTemplateApi 
} = useRecurringTransactions()
const { accounts, isLoading: accountsLoading, error: accountError, getAccounts, getAccountById } = useAccountsSimple()
const auth = useAuthStore()
const { t } = useI18n()
let accountController: AbortController | null = null

// Reactive data
const selectedAccountId = ref('')
const selectedStatus = ref('')
const selectedFrequency = ref('')
const showModal = ref(false)
const selectedTemplate = ref<RecurringTransactionTemplateViewModel | null>(null)
const savedNotice = ref(false)

// A frontend message carries messageKey; a backend message is shown verbatim.
const templatesErrorText = computed(() => {
    const apiError = templatesError.value
    return apiError?.messageKey ? t(apiError.messageKey, apiError.messageParams ?? {}) : apiError?.message || t('recurring.errors.loadFailed')
})
const accountErrorText = computed(() => {
    const apiError = accountError.value
    return apiError?.messageKey ? t(apiError.messageKey, apiError.messageParams ?? {}) : apiError?.message || t('accounts.errors.loadFailed')
})

useHead({ title: computed(() => t('recurring.list.title')) })

// Methods
const loadAccounts = async () => {
    accountController?.abort()
    accountController = new AbortController()
    await getAccounts(accountController.signal)
}

const handleAccountChange = () => {
    getTemplates({ accountId: selectedAccountId.value })
}

const handleStatusChange = () => {
    const isActive = selectedStatus.value === 'active' ? true : 
                    selectedStatus.value === 'inactive' ? false : undefined
    getTemplates({ isActive })
}

const handleFrequencyChange = () => {
    const frequency = selectedFrequency.value ? parseInt(selectedFrequency.value) : undefined
    getTemplates({ frequency })
}

const resetFilters = () => {
    selectedAccountId.value = ''
    selectedStatus.value = ''
    selectedFrequency.value = ''
    getTemplates()
}

const changePage = (page: number) => {
    getTemplates({ pageIndex: page })
}

const openCreateModal = () => {
    savedNotice.value = false
    selectedTemplate.value = null
    showModal.value = true
}

const viewTemplate = (template: RecurringTransactionTemplateViewModel) => {
    savedNotice.value = false
    selectedTemplate.value = template
    showModal.value = true
}

const editTemplate = (template: RecurringTransactionTemplateViewModel) => {
    savedNotice.value = false
    selectedTemplate.value = template
    showModal.value = true
}

const toggleTemplateStatus = async (template: RecurringTransactionTemplateViewModel) => {
    const success = await toggleActiveStatus(template.id, !template.isActive)
    if (success) {
        await getTemplates()
    }
}

const deleteTemplate = async (template: RecurringTransactionTemplateViewModel) => {
    const result = await Swal.fire({
        title: t('common.confirmation.title'),
        text: t('recurring.confirm.delete', { name: template.name }),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: t('common.confirmation.yesDelete'),
        cancelButtonText: t('common.cancel')
    })
    if (result.isConfirmed) {
        const success = await deleteTemplateApi(template.id)
        if (success) {
            await getTemplates()
        }
    }
}

const closeModal = () => {
    showModal.value = false
    selectedTemplate.value = null
}

const handleTemplateSaved = () => {
    savedNotice.value = true
    closeModal()
    getTemplates()
}

watch(() => [auth.token, auth.isAuthenticated] as const, () => {
    clearTemplates()
    accountController?.abort()
    closeModal()
    savedNotice.value = false
    selectedAccountId.value = ''
    selectedStatus.value = ''
    selectedFrequency.value = ''
    if (auth.token && auth.isAuthenticated) {
        void loadAccounts()
        void getTemplates()
    }
}, { flush: 'sync' })

// Frequency value -> label key; an empty or unmapped value is shown verbatim.
const frequencyKeys: Record<RecurrenceFrequency, string> = {
    [RecurrenceFrequency.Daily]: 'enums.recurrenceFrequency.daily',
    [RecurrenceFrequency.Weekly]: 'enums.recurrenceFrequency.weekly',
    [RecurrenceFrequency.Biweekly]: 'enums.recurrenceFrequency.biweekly',
    [RecurrenceFrequency.Monthly]: 'enums.recurrenceFrequency.monthly',
    [RecurrenceFrequency.Quarterly]: 'enums.recurrenceFrequency.quarterly',
    [RecurrenceFrequency.SemiAnnually]: 'enums.recurrenceFrequency.semiAnnually',
    [RecurrenceFrequency.Annually]: 'enums.recurrenceFrequency.annually',
    [RecurrenceFrequency.Custom]: 'enums.recurrenceFrequency.custom'
}
const getFrequencyText = (frequency: RecurrenceFrequency) => {
    const key = frequencyKeys[frequency]
    return key ? t(key) : String(frequency ?? '')
}

// Lifecycle
onMounted(async () => {
    void loadAccounts()
    await getTemplates()
})

onBeforeUnmount(() => {
    accountController?.abort()
    clearTemplates()
})
</script>

<style scoped>
.table-responsive {
    @apply overflow-x-auto;
}

.table-hover tbody tr:hover {
    @apply bg-gray-50 dark:bg-gray-800;
}
</style> 
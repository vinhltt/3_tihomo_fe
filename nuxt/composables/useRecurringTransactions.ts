import { logger } from '~/utils/logger'
import { ref, reactive } from 'vue'
import type { 
    RecurringTransactionTemplateViewModel, 
    RecurringTransactionTemplateCreateRequest,
    RecurringTransactionTemplateUpdateRequest,
    FilterBodyRequest,
    IBasePaging,
    ApiError
} from '~/types'
import { RecurrenceFrequency, RecurringTransactionType } from '~/types'
import { useAuthStore } from '~/stores/auth'
import { errorMessage } from '~/utils/expected-transaction-formatters'

type RecurringTemplateWireModel = Omit<RecurringTransactionTemplateViewModel, 'frequency' | 'transactionType'> & {
    frequency: RecurrenceFrequency | keyof typeof RecurrenceFrequency
    transactionType: RecurringTransactionType | keyof typeof RecurringTransactionType
}

const DEFAULT_PAGE_SIZE = 10

// Resolve a wire enum name to its numeric value; an unknown name is a load error, not a row
const resolveWireEnum = (enumObject: object, value: number | string, field: string): number => {
    if (typeof value === 'number') return value
    const resolved = (enumObject as Record<string, unknown>)[value]
    if (typeof resolved !== 'number') {
        const apiError: ApiError = {
            message: `Invalid recurring transaction template data (${field}: ${value})`,
            messageKey: 'recurring.errors.invalidData',
            messageParams: { field, value: String(value) },
            statusCode: 500
        }
        throw apiError
    }
    return resolved
}

// Map a wire row to a new view model without mutating the response
const toTemplateViewModel = (template: RecurringTemplateWireModel): RecurringTransactionTemplateViewModel => ({
    ...template,
    frequency: resolveWireEnum(RecurrenceFrequency, template.frequency, 'frequency') as RecurrenceFrequency,
    transactionType: resolveWireEnum(RecurringTransactionType, template.transactionType, 'transactionType') as RecurringTransactionType
})

export const useRecurringTransactions = () => {
  const $api = useApi();
    const authStore = useAuthStore()

    // Reactive state
    const templates = ref<RecurringTransactionTemplateViewModel[]>([])
    const loading = ref(false)
    // Display error shape: a frontend message carries messageKey, a backend message is kept verbatim.
    const error = ref<Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null>(null)
    const pagination = reactive({
        pageIndex: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        totalRow: 0,
        pageCount: 0
    })
    let requestSequence = 0
    let readController: AbortController | null = null

    // Build filter request
    const buildFilterRequest = (filters: any = {}): FilterBodyRequest => {
        const filterDetails = []
        
        if (filters.accountId) {
            filterDetails.push({
                attributeName: 'AccountId',
                value: filters.accountId,
                filterType: 0 // Equal
            })
        }
        
        if (filters.isActive !== undefined) {
            filterDetails.push({
                attributeName: 'IsActive',
                value: filters.isActive.toString(),
                filterType: 0 // Equal
            })
        }
        
        if (filters.frequency !== undefined) {
            filterDetails.push({
                attributeName: 'Frequency',
                value: filters.frequency.toString(),
                filterType: 0 // Equal
            })
        }

        return {
            langId: '',
            searchValue: '',
            filter: {
                logicalOperator: 0, // And
                details: filterDetails
            },
            orders: [
                {
                    field: 'CreatedAt',
                    direction: 1 // Descending
                },
                {
                    field: 'id',
                    direction: 1 // Descending tie-breaker for equal CreatedAt
                }
            ],
            pagination: {
                pageIndex: filters.pageIndex || pagination.pageIndex,
                pageSize: filters.pageSize || pagination.pageSize,
                totalRow: 0,
                pageCount: 0
            }
        }
    }

    // Invalidate the in-flight list read so a late response, error or finally cannot touch state
    const invalidateRead = () => {
        requestSequence += 1
        readController?.abort()
        readController = null
    }

    // Drop the list owned by the previous session or owner
    const clearTemplates = () => {
        invalidateRead()
        templates.value = []
        error.value = null
        loading.value = false
        pagination.pageIndex = 1
        pagination.pageSize = DEFAULT_PAGE_SIZE
        pagination.totalRow = 0
        pagination.pageCount = 0
    }

    // Get templates with pagination and filtering
    const getTemplates = async (filters: any = {}) => {
        const request = buildFilterRequest(filters)
        invalidateRead()
        const requestToken = authStore.token
        if (!authStore.isAuthenticated || !requestToken) {
            loading.value = false
            return
        }

        const sequence = requestSequence
        const controller = new AbortController()
        readController = controller
        const isCurrentRequest = () =>
            sequence === requestSequence && authStore.token === requestToken && authStore.isAuthenticated && !controller.signal.aborted

        error.value = null
        loading.value = true
        try {
            const response = await $api.post<IBasePaging<RecurringTemplateWireModel>>(
                '/api/core-finance/RecurringTransactionTemplate/filter',
                request,
                controller.signal
            )
            if (!isCurrentRequest()) return

            templates.value = (response.data ?? []).map(toTemplateViewModel)
            pagination.pageIndex = response.pagination.pageIndex
            pagination.pageSize = response.pagination.pageSize
            pagination.totalRow = response.pagination.totalRow
            pagination.pageCount = response.pagination.pageCount
        } catch (err) {
            if (!isCurrentRequest()) return
            logger.error('Error fetching recurring transaction templates:', err)
            error.value = errorMessage(err, 'recurring.errors.loadFailed')
            templates.value = []
            pagination.totalRow = 0
            pagination.pageCount = 0
        } finally {
            if (sequence === requestSequence) {
                loading.value = false
                readController = null
            }
        }
    }

    // Get the active templates of the signed-in owner; the backend resolves the owner from the token
    const getActiveTemplates = async () => {
        try {
            const response = await $api.get<RecurringTemplateWireModel[]>('/api/core-finance/RecurringTransactionTemplate/active')
            return (response ?? []).map(toTemplateViewModel)
        } catch (error) {
            logger.error('Error fetching active templates:', error)
            throw error
        }
    }

    // Get templates by account
    const getTemplatesByAccount = async (accountId: string) => {
        try {
            const response = await $api.get<RecurringTransactionTemplateViewModel[]>(
                `/api/RecurringTransactionTemplate/account/${accountId}`
            )
            return response || []
        } catch (error) {
            logger.error('Error fetching templates by account:', error)
            return []
        }
    }

    // Create template
    const createTemplate = async (request: RecurringTransactionTemplateCreateRequest) => {
        try {
            error.value = null
            const formBody: Record<string, string> = {}
            for (const [key, value] of Object.entries(request)) {
                if (key !== 'userId' && value !== null && value !== undefined) {
                    formBody[key] = String(value)
                }
            }

            return await $api.postForm<RecurringTransactionTemplateViewModel>(
                '/api/core-finance/RecurringTransactionTemplate',
                formBody
            )
        } catch (err) {
            error.value = errorMessage(err, 'recurring.errors.createFailed')
            throw err
        }
    }

    // Update template
    const updateTemplate = async (id: string, request: RecurringTransactionTemplateUpdateRequest) => {
        try {
            error.value = null
            const formBody: Record<string, string> = {}
            for (const [key, value] of Object.entries(request)) {
                if (key !== 'userId' && value !== null && value !== undefined) {
                    formBody[key] = String(value)
                }
            }

            return await $api.putForm<RecurringTransactionTemplateViewModel>(
                `/api/core-finance/RecurringTransactionTemplate/${id}`,
                formBody
            )
        } catch (err) {
            error.value = errorMessage(err, 'recurring.errors.updateFailed')
            throw err
        }
    }

    // Delete template
    const deleteTemplate = async (id: string) => {
        try {
            await $api.delete(`/api/RecurringTransactionTemplate/${id}`)
            return true
        } catch (error) {
            logger.error('Error deleting recurring transaction template:', error)
            return false
        }
    }

    // Toggle active status
    const toggleActiveStatus = async (templateId: string, isActive: boolean) => {
        try {
            const response = await $api.patch<{ success: boolean, message: string }>(
                `/api/RecurringTransactionTemplate/${templateId}/toggle-active`,
                isActive
            )
            return response.success
        } catch (error) {
            logger.error('Error toggling template status:', error)
            return false
        }
    }

    // Calculate next execution date
    const calculateNextExecutionDate = async (templateId: string) => {
        try {
            const response = await $api.get<{ nextExecutionDate: string }>(
                `/api/RecurringTransactionTemplate/${templateId}/next-execution-date`
            )
            return response.nextExecutionDate
        } catch (error) {
            logger.error('Error calculating next execution date:', error)
            return null
        }
    }

    // Generate expected transactions for a template
    const generateExpectedTransactions = async (templateId: string, daysInAdvance: number = 30) => {
        try {
            const response = await $api.post<{ success: boolean, message: string}>(
                `/api/RecurringTransactionTemplate/${templateId}/generate-expected-transactions?daysInAdvance=${daysInAdvance}`
            )
            return response.success
        } catch (error) {
            logger.error('Error generating expected transactions:', error)
            return false
        }
    }

    // Generate expected transactions for all active templates
    const generateAllExpectedTransactions = async () => {
        try {
            const response = await $api.post<{ success: boolean, message: string}>(
                '/api/RecurringTransactionTemplate/generate-all-expected-transactions'
            )
            return response.success
        } catch (error) {
            logger.error('Error generating all expected transactions:', error)
            return false
        }
    }

    return {
        // State
        templates,
        loading,
        error,
        pagination,
        
        // Methods
        getTemplates,
        clearTemplates,
        getActiveTemplates,
        getTemplatesByAccount,
        createTemplate,
        updateTemplate,
        deleteTemplate,
        toggleActiveStatus,
        calculateNextExecutionDate,
        generateExpectedTransactions,
        generateAllExpectedTransactions
    }
} 
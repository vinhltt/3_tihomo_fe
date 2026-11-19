import type { ApiError, ApiResponse, FilterBodyRequest, FilterDetailsRequest } from '~/types/api'
import { FilterLogicalOperator, FilterType, SortDirection } from '~/types/api'
import type {
  AdjustTransactionRequest,
  CancelTransactionRequest,
  ConfirmTransactionRequest,
  ExpectedCommandResult,
  ExpectedTransactionFilters,
  ExpectedTransactionViewModel,
  ExpectedTransactionWire,
  RecordPaymentRequest,
  RecordPaymentResult,
  RecurringTransactionTemplateViewModel
} from '~/types/recurring-transaction'
import { ExpectedTransactionStatus, RecurringTransactionType } from '~/types/recurring-transaction'

const EXPECTED_ENDPOINT = '/api/core-finance/expectedtransaction'
const TEMPLATE_ENDPOINT = '/api/core-finance/recurringtransactiontemplate/filter'

type TemplateOption = Pick<RecurringTransactionTemplateViewModel, 'id' | 'name'>

const normalizeStatus = (value: number | string): ExpectedTransactionStatus => {
  switch (typeof value === 'string' ? value.trim().toLowerCase() : value) {
    case ExpectedTransactionStatus.Pending:
    case '0':
    case 'pending':
      return ExpectedTransactionStatus.Pending
    case ExpectedTransactionStatus.Confirmed:
    case '1':
    case 'confirmed':
      return ExpectedTransactionStatus.Confirmed
    case ExpectedTransactionStatus.Cancelled:
    case '2':
    case 'cancelled':
      return ExpectedTransactionStatus.Cancelled
    case ExpectedTransactionStatus.Completed:
    case '3':
    case 'completed':
      return ExpectedTransactionStatus.Completed
    default:
      throw {
        message: `API returned an unsupported period status: ${String(value)}.`,
        messageKey: 'expected.errors.unsupportedStatus',
        messageParams: { value: String(value) },
        statusCode: 500
      } satisfies ApiError
  }
}

const normalizeTransactionType = (value: number | string): RecurringTransactionType => {
  switch (typeof value === 'string' ? value.trim().toLowerCase() : value) {
    case RecurringTransactionType.Income:
    case '0':
    case 'income':
    case 'revenue':
      return RecurringTransactionType.Income
    case RecurringTransactionType.Expense:
    case '1':
    case 'expense':
      return RecurringTransactionType.Expense
    case RecurringTransactionType.Transfer:
    case '2':
    case 'transfer':
      return RecurringTransactionType.Transfer
    default:
      throw {
        message: `API returned an unsupported period transaction type: ${String(value)}.`,
        messageKey: 'expected.errors.unsupportedType',
        messageParams: { value: String(value) },
        statusCode: 500
      } satisfies ApiError
  }
}

// The backend serializes enum names, while financial UI consumers use numeric enums.
// DisplayStatus is already an integer projection and must not be derived from persisted Status.
export const normalizeExpectedTransaction = (
  transaction: ExpectedTransactionWire
): ExpectedTransactionViewModel => ({
  ...transaction,
  status: normalizeStatus(transaction.status),
  transactionType: normalizeTransactionType(transaction.transactionType)
})

const nextCalendarDay = (date: string): string => {
  // UTC arithmetic advances the calendar date without local timezone or DST conversion.
  const nextDay = new Date(`${date}T00:00:00Z`)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  return `${nextDay.toISOString().slice(0, 10)}T00:00:00`
}

const buildExpectedFilterBody = (
  filters: ExpectedTransactionFilters,
  pageIndex: number,
  pageSize: number
): FilterBodyRequest => {
  if (!Number.isInteger(pageIndex) || pageIndex < 1 || !Number.isInteger(pageSize) || pageSize < 1) {
    throw {
      message: 'Page index and page size must be positive integers.',
      messageKey: 'expected.errors.invalidPaging',
      statusCode: 400
    } satisfies ApiError
  }

  const details: FilterDetailsRequest[] = []
  if (filters.displayStatus !== undefined) {
    details.push({
      attributeName: 'displayStatus',
      filterType: FilterType.Equal,
      value: String(filters.displayStatus)
    })
  }
  if (filters.dateFrom) {
    details.push({
      attributeName: 'expectedDate',
      filterType: FilterType.GreaterThanOrEqual,
      value: filters.dateFrom
    })
  }
  if (filters.dateTo) {
    details.push({
      attributeName: 'expectedDate',
      filterType: FilterType.LessThan,
      value: nextCalendarDay(filters.dateTo)
    })
  }
  if (filters.templateId) {
    details.push({
      attributeName: 'recurringTransactionTemplateId',
      filterType: FilterType.Equal,
      value: filters.templateId
    })
  }

  return {
    langId: '',
    searchValue: filters.search ?? '',
    filter: details.length ? { logicalOperator: FilterLogicalOperator.And, details } : {},
    orders: [
      { field: 'expectedDate', direction: SortDirection.Ascending },
      { field: 'id', direction: SortDirection.Ascending }
    ],
    pagination: { pageIndex, pageSize, totalRow: 0, pageCount: 0 }
  }
}

export const useExpectedTransactions = () => {
  const { get, post } = useApi()
  const revision = useState<number>('expected-transactions-revision', () => 0)

  const getExpectedTransactions = async (
    filters: ExpectedTransactionFilters,
    pageIndex = 1,
    pageSize = 10,
    signal?: AbortSignal
  ): Promise<ApiResponse<ExpectedTransactionViewModel>> => {
    const response = await post<ApiResponse<ExpectedTransactionWire>>(
      `${EXPECTED_ENDPOINT}/filter`,
      buildExpectedFilterBody(filters, pageIndex, pageSize),
      signal
    )
    return { ...response, data: response.data.map(normalizeExpectedTransaction) }
  }

  const getExpectedTransaction = async (
    id: string,
    signal?: AbortSignal
  ): Promise<ExpectedTransactionViewModel> => {
    const response = await get<ExpectedTransactionWire>(
      `${EXPECTED_ENDPOINT}/${encodeURIComponent(id)}`,
      undefined,
      signal
    )
    return normalizeExpectedTransaction(response)
  }

  const getTemplateOptions = async (signal?: AbortSignal): Promise<TemplateOption[]> => {
    const options = new Map<string, TemplateOption>()
    let pageIndex = 1
    let pageCount: number
    do {
      signal?.throwIfAborted()
      const body: FilterBodyRequest = {
        langId: '',
        searchValue: '',
        filter: {},
        orders: [
          { field: 'name', direction: SortDirection.Ascending },
          { field: 'id', direction: SortDirection.Ascending }
        ],
        pagination: { pageIndex, pageSize: 100, totalRow: 0, pageCount: 0 }
      }
      const response = await post<ApiResponse<TemplateOption>>(TEMPLATE_ENDPOINT, body, signal)
      signal?.throwIfAborted()
      // Deduplicate a previously served page if concurrent deletion makes the server clamp it.
      for (const template of response.data) {
        options.set(template.id, { id: template.id, name: template.name })
      }
      // Advance a local counter: an echoed pageIndex that never increments must not loop forever.
      pageCount = response.pagination.pageCount
      pageIndex += 1
    } while (pageIndex <= pageCount)
    return Array.from(options.values())
  }

  const recordPayment = (id: string, request: RecordPaymentRequest): Promise<RecordPaymentResult> => {
    const body: RecordPaymentRequest = request.accountId === undefined ? {} : { accountId: request.accountId }
    return post<RecordPaymentResult>(`${EXPECTED_ENDPOINT}/${encodeURIComponent(id)}/record-payment`, body)
  }

  const confirm = (id: string, actualTransactionId: string): Promise<ExpectedCommandResult> => {
    const body: ConfirmTransactionRequest = { actualTransactionId }
    return post<ExpectedCommandResult>(`${EXPECTED_ENDPOINT}/${encodeURIComponent(id)}/confirm`, body)
  }

  const cancel = (id: string, reason: string): Promise<ExpectedCommandResult> => {
    const body: CancelTransactionRequest = { reason }
    return post<ExpectedCommandResult>(`${EXPECTED_ENDPOINT}/${encodeURIComponent(id)}/cancel`, body)
  }

  const adjust = (id: string, newAmount: number, reason: string): Promise<ExpectedCommandResult> => {
    const body: AdjustTransactionRequest = { newAmount, reason }
    return post<ExpectedCommandResult>(`${EXPECTED_ENDPOINT}/${encodeURIComponent(id)}/adjust`, body)
  }

  const notifyMutation = (): void => {
    revision.value += 1
  }

  return {
    getExpectedTransactions,
    getExpectedTransaction,
    getTemplateOptions,
    recordPayment,
    confirm,
    cancel,
    adjust,
    revision,
    notifyMutation
  }
}

import { useExpectedTransactions } from '~/composables/useExpectedTransactions'
import type { ApiResponse, FilterBodyRequest, FilterDetailsRequest } from '~/types/api'
import { FilterLogicalOperator, FilterType, SortDirection } from '~/types/api'
import type {
  Debt,
  DebtCreateRequest,
  DebtDeletePreview,
  DebtDisbursementInput,
  DebtFilterForm,
  DebtForm,
  DebtInstallment,
  DebtInstallmentForm,
  DebtPayment,
  DebtPaymentForm,
  DebtRecalculationForm,
  DebtRecalculationPreview,
  DebtSchedule,
  DebtScheduleForm,
  DebtTotals,
  DebtUpdateRequest
} from '~/types/debt'
import { toPaymentRequest } from '~/utils/debt-payment-rules'
import { toInstallmentRequest, toRecalculationRequest, toScheduleRequest } from '~/utils/debt-schedule-rules'

const DEBT_ENDPOINT = '/api/planning-investment/debt'

const debtPath = (id: string): string => `${DEBT_ENDPOINT}/${encodeURIComponent(id)}`

const paymentPath = (debtId: string, paymentId: string): string => `${debtPath(debtId)}/payments/${encodeURIComponent(paymentId)}`

const buildDebtFilterBody = (filters: DebtFilterForm, pageIndex: number, pageSize: number): FilterBodyRequest => {
  const details: FilterDetailsRequest[] = []
  if (filters.direction) details.push({ attributeName: 'direction', filterType: FilterType.Equal, value: filters.direction })
  if (filters.status) details.push({ attributeName: 'status', filterType: FilterType.Equal, value: filters.status })
  return {
    langId: '',
    searchValue: '',
    filter: details.length ? { logicalOperator: FilterLogicalOperator.And, details } : {},
    // The server appends the id, so debts with equal times never move between pages.
    orders: [{ field: 'createdAt', direction: SortDirection.Descending }],
    pagination: { pageIndex, pageSize, totalRow: 0, pageCount: 0 }
  }
}

const toDescription = (form: DebtForm): DebtUpdateRequest => ({
  name: form.name.trim(),
  description: form.description.trim() || null,
  counterparty: form.counterparty.trim(),
  debtType: form.debtType,
  interestRate: form.interestRate ? Number(form.interestRate) : null,
  originalAmount: Number(form.originalAmount),
  initialBalance: form.initialBalance ? Number(form.initialBalance) : null,
  notes: form.notes.trim() || null
})

const toDisbursement = (form: DebtForm): DebtDisbursementInput =>
  form.disbursementMode === 'create' ? { mode: 'create', accountId: form.accountId } : { mode: 'link', transactionId: form.transaction?.id ?? null }

const toCreateRequest = (form: DebtForm): DebtCreateRequest => ({
  ...toDescription(form),
  direction: form.direction,
  startDate: form.startDate,
  disbursement: form.recordDisbursement ? toDisbursement(form) : null
})

// A closed debt only changes its name, counterparty, type and notes; the other fields go back as they are stored.
const toUpdateRequest = (debt: Debt, form: DebtForm): DebtUpdateRequest =>
  debt.status === 'Closed'
    ? {
        ...toDescription(form),
        description: debt.description,
        interestRate: debt.interestRate,
        originalAmount: debt.originalAmount,
        initialBalance: debt.initialBalance
      }
    : toDescription(form)

/**
 * Calls of the debt API. Reads take an AbortSignal; mutations are never aborted or retried. (EN)
 *
 * Các lời gọi API khoản nợ. Lời đọc nhận AbortSignal; thao tác ghi không bị hủy và không tự thử lại. (VI)
 */
export const useDebts = () => {
  const { get, post, put, delete: del } = useApi()
  const { notifyMutation } = useExpectedTransactions()

  // Readers refresh after a failure too: a refused or unanswered mutation can leave the stored state different from the screen.
  const mutate = async <T>(request: Promise<T>): Promise<T> => {
    try {
      return await request
    } finally {
      notifyMutation()
    }
  }

  const getDebts = (filters: DebtFilterForm, pageIndex = 1, pageSize = 10, signal?: AbortSignal): Promise<ApiResponse<Debt>> =>
    post<ApiResponse<Debt>>(`${DEBT_ENDPOINT}/filter`, buildDebtFilterBody(filters, pageIndex, pageSize), signal)

  const getTotals = (signal?: AbortSignal): Promise<DebtTotals> => get<DebtTotals>(`${DEBT_ENDPOINT}/totals`, undefined, signal)

  const getDebt = (id: string, signal?: AbortSignal): Promise<Debt> => get<Debt>(debtPath(id), undefined, signal)

  const getDeletePreview = (id: string, signal?: AbortSignal): Promise<DebtDeletePreview> =>
    get<DebtDeletePreview>(`${debtPath(id)}/delete-preview`, undefined, signal)

  const createDebt = (form: DebtForm): Promise<Debt> => mutate(post<Debt>(DEBT_ENDPOINT, toCreateRequest(form)))

  const updateDebt = (debt: Debt, form: DebtForm): Promise<Debt> => mutate(put<Debt>(debtPath(debt.id), toUpdateRequest(debt, form)))

  const closeDebt = (id: string): Promise<Debt> => mutate(post<Debt>(`${debtPath(id)}/close`))

  const deleteDebt = (id: string): Promise<void> => mutate(del<void>(debtPath(id)))

  // No content means that the resync finished a deletion.
  const resyncDebt = (id: string): Promise<Debt | undefined> => mutate(post<Debt | undefined>(`${debtPath(id)}/resync`))

  const getPayments = (id: string, signal?: AbortSignal): Promise<DebtPayment[]> => get<DebtPayment[]>(`${debtPath(id)}/payments`, undefined, signal)

  const recordPayment = (id: string, form: DebtPaymentForm, clientIdempotencyKey: string): Promise<DebtPayment> =>
    mutate(post<DebtPayment>(`${debtPath(id)}/payments${form.mode === 'link' ? '/link' : ''}`, { ...toPaymentRequest(form), clientIdempotencyKey }))

  const resyncPayment = (id: string, paymentId: string): Promise<DebtPayment> => mutate(post<DebtPayment>(`${paymentPath(id, paymentId)}/resync`))

  const cancelPayment = (id: string, paymentId: string): Promise<DebtPayment> => mutate(post<DebtPayment>(`${paymentPath(id, paymentId)}/cancel`))

  const getInstallments = (id: string, signal?: AbortSignal): Promise<DebtInstallment[]> =>
    get<DebtInstallment[]>(`${debtPath(id)}/installments`, undefined, signal)

  const createSchedule = (id: string, form: DebtScheduleForm): Promise<DebtSchedule> =>
    mutate(post<DebtSchedule>(`${debtPath(id)}/schedule`, toScheduleRequest(form)))

  // A read, although it is a POST.
  const previewRecalculation = (id: string, signal?: AbortSignal): Promise<DebtRecalculationPreview> =>
    post<DebtRecalculationPreview>(`${debtPath(id)}/schedule/recalculate/preview`, undefined, signal)

  const recalculateSchedule = (id: string, form: DebtRecalculationForm, preview: DebtRecalculationPreview): Promise<DebtSchedule> =>
    mutate(post<DebtSchedule>(`${debtPath(id)}/schedule/recalculate`, toRecalculationRequest(form, preview)))

  const adjustInstallment = (id: string, installmentId: string, form: DebtInstallmentForm): Promise<DebtInstallment> =>
    mutate(put<DebtInstallment>(`${debtPath(id)}/installments/${encodeURIComponent(installmentId)}`, toInstallmentRequest(form)))

  return {
    getDebts,
    getTotals,
    getDebt,
    getDeletePreview,
    createDebt,
    updateDebt,
    closeDebt,
    deleteDebt,
    resyncDebt,
    getPayments,
    recordPayment,
    resyncPayment,
    cancelPayment,
    getInstallments,
    createSchedule,
    previewRecalculation,
    recalculateSchedule,
    adjustInstallment
  }
}

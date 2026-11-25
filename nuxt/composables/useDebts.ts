import { onScopeDispose, ref, watch } from 'vue'
import { useExpectedTransactions } from '~/composables/useExpectedTransactions'
import { useAuthStore } from '~/stores/auth'
import type { ApiResponse, FilterBodyRequest, FilterDetailsRequest } from '~/types/api'
import { FilterLogicalOperator, FilterType, SortDirection } from '~/types/api'
import type {
  Debt,
  DebtCreateRequest,
  DebtDeletePreview,
  DebtDialog,
  DebtDisplayError,
  DebtFilterForm,
  DebtForm,
  DebtTotals,
  DebtUpdateRequest
} from '~/types/debt'
import { debtCloseDialog, debtDeleteDialog } from '~/utils/debt-formatters'
import { errorMessage } from '~/utils/expected-transaction-formatters'

const DEBT_ENDPOINT = '/api/planning-investment/debt'

const debtPath = (id: string): string => `${DEBT_ENDPOINT}/${encodeURIComponent(id)}`

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

const toCreateRequest = (form: DebtForm): DebtCreateRequest => ({
  ...toDescription(form),
  direction: form.direction,
  startDate: form.startDate,
  disbursement: form.recordDisbursement ? { mode: 'create', accountId: form.accountId } : null
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

  return { getDebts, getTotals, getDebt, getDeletePreview, createDebt, updateDebt, closeDebt, deleteDebt, resyncDebt }
}

/**
 * Close, delete and resync of one debt at a time, shared by every screen that shows a debt. The screen owns the dialog: it
 * shows the given keys and answers whether the owner confirmed. (EN)
 *
 * Đóng, xóa và đồng bộ lại từng khoản, dùng chung cho mọi màn hình có khoản nợ. Màn hình giữ hộp thoại: hiện các key được
 * đưa và trả lời chủ khoản có xác nhận hay không. (VI)
 */
export const useDebtActions = (confirm: (dialog: DebtDialog) => Promise<boolean>) => {
  const auth = useAuthStore()
  const { getDebt, getDeletePreview, closeDebt, deleteDebt, resyncDebt } = useDebts()
  const actionId = ref<string | null>(null)
  const actionError = ref<DebtDisplayError | null>(null)
  const noticeKey = ref<string | null>(null)
  let controller: AbortController | null = null

  const clearAction = (): void => {
    controller?.abort()
    controller = null
    actionId.value = null
    actionError.value = null
    noticeKey.value = null
  }

  // The action answers the key of its notice, or null when the owner did not confirm.
  const run = async (debt: Debt, action: (signal: AbortSignal) => Promise<string | null>): Promise<void> => {
    if (actionId.value || !auth.isAuthenticated || !auth.token) return
    clearAction()
    const current = new AbortController()
    controller = current
    actionId.value = debt.id
    try {
      const notice = await action(current.signal)
      if (!current.signal.aborted) noticeKey.value = notice
    } catch (error) {
      if (!current.signal.aborted) actionError.value = errorMessage(error, 'debts.errors.checkAndRetry')
    } finally {
      if (!current.signal.aborted) {
        actionId.value = null
        controller = null
      }
    }
  }

  // Closing cannot be undone, so its warning uses the debt as it is now and not as it was listed.
  const requestClose = (debt: Debt): Promise<void> =>
    run(debt, async signal => {
      const fresh = await getDebt(debt.id, signal)
      if (signal.aborted || !(await confirm(debtCloseDialog(fresh))) || signal.aborted) return null
      await closeDebt(debt.id)
      return 'debts.notice.closed'
    })

  const requestDelete = (debt: Debt): Promise<void> =>
    run(debt, async signal => {
      const { disbursement } = await getDeletePreview(debt.id, signal)
      if (signal.aborted || !(await confirm(debtDeleteDialog(debt, disbursement))) || signal.aborted) return null
      await deleteDebt(debt.id)
      return 'debts.notice.deleted'
    })

  const retry = (debt: Debt): Promise<void> => run(debt, async () => ((await resyncDebt(debt.id)) ? 'debts.notice.resynced' : 'debts.notice.deleted'))

  watch(() => [auth.token, auth.isAuthenticated], clearAction, { flush: 'sync' })
  onScopeDispose(clearAction)

  return { actionId, actionError, noticeKey, requestClose, requestDelete, retry }
}

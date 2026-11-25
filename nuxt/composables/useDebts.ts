import { nextTick, onBeforeUnmount, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useExpectedTransactions } from '~/composables/useExpectedTransactions'
import { useAuthStore } from '~/stores/auth'
import type { ApiResponse, FilterBodyRequest, FilterDetailsRequest } from '~/types/api'
import { FilterLogicalOperator, FilterType, SortDirection } from '~/types/api'
import type {
  Debt,
  DebtCreateRequest,
  DebtDeletePreview,
  DebtDialog,
  DebtDisbursementInput,
  DebtDisplayError,
  DebtFilterForm,
  DebtForm,
  DebtPayment,
  DebtPaymentForm,
  DebtTotals,
  DebtUpdateRequest
} from '~/types/debt'
import { debtCancelPaymentDialog, debtCloseDialog, debtDeleteDialog, newAttemptKey, toPaymentRequest } from '~/utils/debt-formatters'
import { errorMessage } from '~/utils/expected-transaction-formatters'

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
    cancelPayment
  }
}

/**
 * Key of one attempt to record the given content: sending the same content again repeats the key, and any change of the
 * content replaces it. (EN)
 *
 * Khóa của một lần ghi nhận nội dung được đưa: gửi lại đúng nội dung thì lặp lại khóa, nội dung đổi thì thay khóa. (VI)
 */
export const useAttemptKey = (content: () => unknown): (() => string) => {
  let key = newAttemptKey()
  watch(() => JSON.stringify(content()), () => { key = newAttemptKey() }, { flush: 'sync' })
  return () => key
}

/**
 * Close, delete and resync of one debt at a time, and cancel and resync of its payments, shared by every screen that shows a
 * debt. The screen owns the dialog: it shows the given keys and answers whether the owner confirmed. (EN)
 *
 * Đóng, xóa và đồng bộ lại từng khoản, hủy và đồng bộ lại thanh toán của khoản, dùng chung cho mọi màn hình có khoản nợ. Màn
 * hình giữ hộp thoại: hiện các key được đưa và trả lời chủ khoản có xác nhận hay không. (VI)
 */
export const useDebtActions = (confirm: (dialog: DebtDialog) => Promise<boolean>) => {
  const auth = useAuthStore()
  const { getDebt, getDeletePreview, closeDebt, deleteDebt, resyncDebt, resyncPayment, cancelPayment } = useDebts()
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

  const requestCancelPayment = (debt: Debt, payment: DebtPayment): Promise<void> =>
    run(debt, async signal => {
      if (!(await confirm(debtCancelPaymentDialog(payment))) || signal.aborted) return null
      await cancelPayment(debt.id, payment.id)
      return 'debts.notice.paymentCancelled'
    })

  const retryPayment = (debt: Debt, payment: DebtPayment): Promise<void> =>
    run(debt, async () => {
      await resyncPayment(debt.id, payment.id)
      return 'debts.notice.paymentSynced'
    })

  watch(() => [auth.token, auth.isAuthenticated], clearAction, { flush: 'sync' })
  onScopeDispose(clearAction)

  return { actionId, actionError, noticeKey, requestClose, requestDelete, retry, requestCancelPayment, retryPayment }
}

/**
 * Focus and keys of an open form dialog: the focus moves in and goes back when it closes, Escape closes it and Tab stays
 * inside. isCurrent is false once the dialog is gone or the session changed. (EN)
 *
 * Con trỏ và phím của hộp thoại form đang mở: con trỏ vào hộp thoại và trở lại khi đóng, Escape đóng và Tab ở trong hộp.
 * isCurrent là false khi hộp thoại đã đóng hoặc phiên đã đổi. (VI)
 */
export const useDebtDialog = (close: () => void) => {
  const auth = useAuthStore()
  const dialog = ref<HTMLElement | null>(null)
  const openingToken = auth.token
  let disposed = false
  let previousFocus: HTMLElement | null = null

  const isCurrent = (): boolean => !disposed && auth.isAuthenticated && auth.token === openingToken

  // Listens on the document: a control that is disabled or removed while it has the focus drops the focus out of the dialog.
  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab' || !dialog.value) return
    const controls = Array.from(dialog.value.querySelectorAll<HTMLElement>('button, input, select, textarea')).filter(control => !control.matches(':disabled'))
    const first = controls[0]
    const last = controls[controls.length - 1]
    const active = document.activeElement
    const outside = !dialog.value.contains(active)
    if (event.shiftKey && (outside || active === first || active === dialog.value)) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && (outside || active === last)) {
      event.preventDefault()
      first?.focus()
    }
  }

  onMounted(() => {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.addEventListener('keydown', handleKeydown)
    void nextTick(() => dialog.value?.focus())
  })
  onBeforeUnmount(() => {
    // Focus goes back after an ordinary dismissal, never after a session change.
    const restoreFocus = isCurrent()
    disposed = true
    document.removeEventListener('keydown', handleKeydown)
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus()
  })

  return { dialog, isCurrent }
}

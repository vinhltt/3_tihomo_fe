import { onScopeDispose, ref, watch } from 'vue'
import { useDebts } from '~/composables/useDebts'
import { useAuthStore } from '~/stores/auth'
import type { Debt, DebtDialog, DebtDisplayError, DebtPayment } from '~/types/debt'
import { debtCloseDialog, debtDeleteDialog } from '~/utils/debt-formatters'
import { debtCancelPaymentDialog } from '~/utils/debt-payment-rules'
import { errorMessage } from '~/utils/expected-transaction-formatters'

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

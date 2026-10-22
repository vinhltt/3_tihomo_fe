import type { ApiError } from '~/types/api'
import type { ExpectedTransactionViewModel, ExpectedTransactionWire } from '~/types/recurring-transaction'
import { normalizeExpectedTransaction } from '~/composables/useExpectedTransactions'

type ExpectedTransactionReminderResponse = {
  data: ExpectedTransactionWire[]
  totalRow: number
}

export const useExpectedTransactionReminders = () => {
  const { get } = useApi()
  const authStore = useAuthStore()
  const reminders = useState<ExpectedTransactionViewModel[]>('expected-transaction-reminders', () => [])
  const loading = useState<boolean>('expected-transaction-reminders-loading', () => false)
  const error = useState<string | null>('expected-transaction-reminders-error', () => null)
  const count = computed(() => reminders.value.length)

  // Header is the sole lifecycle owner; execution state stays private to its consumer.
  let active = false
  let requestSequence = 0
  let readController: AbortController | null = null
  let inFlight: Promise<void> | null = null
  let queuedRefresh = false

  const invalidate = (): void => {
    requestSequence += 1
    readController?.abort()
    readController = null
    inFlight = null
    queuedRefresh = false
    reminders.value = []
    loading.value = false
    error.value = null
  }

  const refresh = (): Promise<void> => {
    const requestToken = authStore.token
    if (!process.client || !active || !authStore.isAuthenticated || !requestToken) {
      return Promise.resolve()
    }

    if (readController) {
      queuedRefresh = true
      return inFlight ?? Promise.resolve()
    }

    const sequence = ++requestSequence
    const controller = new AbortController()
    readController = controller
    queuedRefresh = false
    const isCurrentRequest = (): boolean =>
      active &&
      sequence === requestSequence &&
      authStore.token === requestToken &&
      authStore.isAuthenticated &&
      readController === controller &&
      !controller.signal.aborted

    loading.value = true
    if (isCurrentRequest()) error.value = null

    const readReminders = async (): Promise<void> => {
      try {
        while (isCurrentRequest()) {
          try {
            const response = await get<ExpectedTransactionReminderResponse>(
              '/api/core-finance/expectedtransaction/reminders',
              undefined,
              controller.signal
            )
            if (!isCurrentRequest()) return
            reminders.value = response.data.map(normalizeExpectedTransaction)
          } catch (err) {
            if (!isCurrentRequest()) return
            // A failed refresh never keeps stale items or a stale badge next to the error.
            reminders.value = []
            error.value = (err as ApiError)?.message || 'Không thể tải danh sách nhắc hạn.'
          }

          // Success and failure both drain one coalesced canonical read, never a retry.
          if (!isCurrentRequest() || !queuedRefresh) return
          queuedRefresh = false
          error.value = null
        }
      } finally {
        if (isCurrentRequest()) {
          readController = null
          inFlight = null
          queuedRefresh = false
          loading.value = false
        }
      }
    }

    const request = readReminders()
    if (isCurrentRequest()) inFlight = request
    return request
  }

  const start = (): void => {
    if (!process.client || active) return
    invalidate()
    active = true
    void refresh()
  }

  const stop = (): void => {
    active = false
    invalidate()
  }

  watch(
    () => [authStore.token, authStore.isAuthenticated],
    () => {
      // Only the started owner may clear the shared state; other instances never touch it.
      if (!active) return
      invalidate()
      void refresh()
    },
    { flush: 'sync' }
  )
  onScopeDispose(() => {
    if (active) stop()
  })

  return { reminders, loading, error, count, start, stop, refresh }
}

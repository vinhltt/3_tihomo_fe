import type { AccountSelection, ApiError } from '~/types'

export const useAccountsSimple = () => {
  const { get } = useApi()
  const authStore = useAuthStore()
  
  // Reactive state
  const accounts = ref<AccountSelection[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let requestSequence = 0
  let readController: AbortController | null = null

  const clearAccounts = (): void => {
    requestSequence += 1
    readController?.abort()
    readController = null
    accounts.value = []
    isLoading.value = false
    error.value = null
  }

  watch(() => [authStore.token, authStore.isAuthenticated], clearAccounts, { flush: 'sync' })
  onScopeDispose(clearAccounts)

  /**
   * Fetch the raw, owner-scoped account selection list.
   */
  const getAccounts = async (signal?: AbortSignal): Promise<void> => {
    clearAccounts()
    const requestToken = authStore.token
    if (!authStore.isAuthenticated || !requestToken || signal?.aborted) return

    const sequence = requestSequence
    const controller = new AbortController()
    readController = controller
    const isCurrentRequest = () =>
      sequence === requestSequence && authStore.token === requestToken && authStore.isAuthenticated
    const abortRead = () => {
      controller.abort()
      if (isCurrentRequest()) clearAccounts()
    }
    signal?.addEventListener('abort', abortRead, { once: true })

    isLoading.value = true
    try {
      const response = await get<AccountSelection[]>(
        '/api/core-finance/account/selections',
        undefined,
        controller.signal
      )
      if (isCurrentRequest() && !controller.signal.aborted) {
        accounts.value = response
      }
    } catch (err) {
      if (isCurrentRequest() && !controller.signal.aborted) {
        error.value = (err as ApiError)?.message || 'Lỗi khi tải danh sách tài khoản'
        accounts.value = []
      }
    } finally {
      signal?.removeEventListener('abort', abortRead)
      if (isCurrentRequest()) {
        isLoading.value = false
        readController = null
      }
    }
  }

  /**
   * Get account by ID
   */
  const getAccountById = (id: string): AccountSelection | undefined => {
    return accounts.value.find(account => account.id === id)
  }

  /**
   * Get account name by ID
   */
  const getAccountName = (id: string): string => {
    const account = getAccountById(id)
    return account?.name || 'Không xác định'
  }

  return {
    // State
    accounts: readonly(accounts),
    isLoading: readonly(isLoading),
    error: readonly(error),
    
    // Methods
    getAccounts,
    getAccountById,
    getAccountName,
    clearAccounts
  }
} 
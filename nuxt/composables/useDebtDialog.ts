import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { newAttemptKey } from '~/utils/debt-payment-rules'

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

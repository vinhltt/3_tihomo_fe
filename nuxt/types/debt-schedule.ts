import type { DebtPayment, DebtScheduleMethod } from './debt'

/**
 * Status of an installment; Confirmed means that its payment is recorded. (EN)
 *
 * Trạng thái kỳ; Confirmed nghĩa là đã ghi nhận thanh toán của kỳ. (VI)
 */
export type DebtInstallmentStatus = 'Pending' | 'Confirmed' | 'Cancelled' | 'Completed'

/**
 * One installment with its live payment. The amounts are the expected ones, the original amounts those before the first
 * change by hand; dueDate is a calendar day (YYYY-MM-DD). (EN)
 *
 * Một kỳ kèm thanh toán còn hiệu lực. Các số tiền là số dự kiến, số original là số trước lần chỉnh tay đầu tiên; dueDate là
 * ngày lịch (YYYY-MM-DD). (VI)
 */
export type DebtInstallment = {
  id: string
  scheduleVersion: number
  installmentNo: number
  dueDate: string
  principal: number
  interest: number
  amount: number
  originalPrincipal: number | null
  originalInterest: number | null
  isAdjusted: boolean
  adjustmentReason: string | null
  status: DebtInstallmentStatus
  cancelledBySettlement: boolean
  payment: DebtPayment | null
}

export type DebtSchedule = { version: number; installments: DebtInstallment[] }

/**
 * What a recalculation starts from: version goes back as the expected version, pendingPrincipal is already left out of the
 * balance, and the two defaults are null when the owner has to enter them. (EN)
 *
 * Điểm xuất phát của việc tính lại: version được gửi lại làm phiên bản mong đợi, pendingPrincipal đã trừ khỏi balance, và hai
 * giá trị mặc định là null khi chủ khoản phải nhập. (VI)
 */
export type DebtRecalculationPreview = {
  version: number
  balance: number
  pendingPrincipal: number
  replacedCount: number
  adjustedCount: number
  installmentCount: number | null
  nextDueDate: string | null
}

/**
 * What the schedule dialogs hold. Numbers stay as the typed text until they are sent. (EN)
 *
 * Nội dung các hộp thoại lịch. Số giữ nguyên chữ đã nhập cho đến khi gửi. (VI)
 */
export type DebtScheduleForm = { method: DebtScheduleMethod; firstDueDate: string; installmentCount: string }

export type DebtRecalculationForm = { installmentCount: string; nextDueDate: string }

export type DebtInstallmentForm = { principal: string; interest: string; reason: string }

export type DebtScheduleRequest = { method: DebtScheduleMethod; firstDueDate: string; installmentCount: number | null }

/**
 * Replaces the installments that are not processed yet. The number and the day are left out when nothing is left to pay. (EN)
 *
 * Thay các kỳ chưa xử lý. Không gửi số kỳ và ngày khi không còn gì để trả. (VI)
 */
export type DebtRecalculationRequest = { installmentCount?: number | null; nextDueDate?: string; expectedVersion: number }

export type DebtInstallmentRequest = { principal: number; interest: number; reason: string }

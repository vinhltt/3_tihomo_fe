<template>
  <div class="panel h-full">
    <!-- Header -->
    <div class="mb-5 flex items-center justify-between border-b pb-5 dark:border-[#1b2e4b]">
      <h5 class="text-lg font-semibold dark:text-white-light">
        <span v-if="mode === 'create'">{{ t('transactions.form.createTitle') }}</span>
        <span v-else-if="mode === 'edit'">{{ t('transactions.form.editTitle') }}</span>
        <span v-else>{{ t('transactions.form.viewTitle') }}</span>
      </h5>
      <button 
        @click="handleClose"
        class="btn btn-sm btn-outline-danger hover:bg-danger hover:text-white transition-colors"
        :title="t('transactions.form.closeHint')"
      >
        <icon-x class="w-4 h-4" />
      </button>
    </div>

    <!-- Error Alert -->
    <div v-if="errorText" class="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg">
      <div class="flex items-center gap-2 text-danger">
        <icon-alert-circle class="w-4 h-4" />
        <span>{{ errorText }}</span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <p class="mt-2 text-gray-500">{{ t('transactions.form.processing') }}</p>
    </div>

    <!-- Form -->
    <form v-else ref="formRef" novalidate @submit.prevent="handleSubmit" class="space-y-5">
      <!-- Simple Mode Fields -->
      <div class="space-y-4">
        <!-- Transaction Direction -->
        <div>
          <label class="text-sm font-medium text-white-dark">
            {{ t('transactions.fields.direction') }} *
          </label>
          <select 
            v-model="form.transactionDirection" 
            :disabled="mode === 'view'"
            class="form-select"
            required
          >
            <option :value="TransactionDirectionConst.Revenue">{{ t('enums.transactionDirection.revenue') }}</option>
            <option :value="TransactionDirectionConst.Spent">{{ t('enums.transactionDirection.spent') }}</option>
          </select>
        </div>

        <!-- Amount -->
        <div>
          <label class="text-sm font-medium text-white-dark">
            {{ t('transactions.fields.amount') }} *
          </label>
          <input 
            v-model.number="form.amount" 
            :disabled="mode === 'view'"
            type="number" 
            class="form-input"
            :placeholder="t('transactions.placeholders.amount')"
            required
          />
        </div>

        <!-- Transaction Date -->
        <div>
          <label class="text-sm font-medium text-white-dark">
            {{ t('transactions.fields.transactionDateTime') }} *
          </label>
          <input 
            v-model="form.transactionDate" 
            :disabled="mode === 'view'"
            type="datetime-local" 
            class="form-input"
            required
          />
        </div>

        <!-- Account -->
        <div>
          <label class="text-sm font-medium text-white-dark">
            {{ t('transactions.fields.account') }} *
          </label>
          <select 
            v-model="form.accountId" 
            :disabled="mode === 'view'"
            class="form-select"
            required
          >
            <option value="">{{ t('transactions.placeholders.selectAccount') }}</option>
            <option 
              v-for="account in accounts" 
              :key="account.id" 
              :value="account.id"
            >
              {{ account.name }}
            </option>
          </select>
        </div>

        <!-- Category Type -->
        <div>
          <label class="text-sm font-medium text-white-dark">
            {{ t('transactions.fields.category') }} *
          </label>
          <select 
            v-model="form.categoryType" 
            :disabled="mode === 'view'"
            class="form-select"
            required
          >
            <option :value="CategoryTypeConst.Income">{{ t('enums.categoryType.income') }}</option>
            <option :value="CategoryTypeConst.Expense">{{ t('enums.categoryType.expense') }}</option>
            <option :value="CategoryTypeConst.Transfer">{{ t('enums.categoryType.transfer') }}</option>
            <option :value="CategoryTypeConst.Fee">{{ t('enums.categoryType.fee') }}</option>
            <option :value="CategoryTypeConst.Other">{{ t('enums.categoryType.other') }}</option>
          </select>
        </div>

        <!-- Description -->
        <div>
          <label class="text-sm font-medium text-white-dark">
            {{ t('transactions.fields.description') }}
          </label>
          <input 
            v-model="form.description" 
            :disabled="mode === 'view'"
            type="text" 
            class="form-input"
            :placeholder="t('transactions.placeholders.description')"
          />
        </div>
      </div>

      <!-- Toggle Advanced Mode -->
      <div class="border-t pt-5 dark:border-[#1b2e4b]">
        <button 
          type="button"
          @click="showAdvanced = !showAdvanced"
          class="btn btn-outline-info btn-sm"
          :disabled="mode === 'view'"
        >
          <icon-chevron-down 
            :class="{ 'rotate-180': showAdvanced }"
            class="w-4 h-4 transition-transform"
          />
          {{ showAdvanced ? t('transactions.form.hideAdvanced') : t('transactions.form.showAdvanced') }}
        </button>
      </div>

      <!-- Advanced Mode Fields -->
      <div v-if="showAdvanced" class="space-y-4 border-t pt-5 dark:border-[#1b2e4b]">
        <!-- Balance -->
        <div>
          <label class="text-sm font-medium text-white-dark">
            {{ t('transactions.fields.balanceAfter') }} *
          </label>
          <input 
            v-model.number="form.balance" 
            :disabled="mode === 'view'"
            type="number" 
            step="1"
            class="form-input"
            :placeholder="t('transactions.placeholders.balance')"
            required
          />
        </div>
        <!-- Financial Info Group -->
        <div class="space-y-4">
          <h6 class="text-md font-semibold">{{ t('transactions.form.financialInfo') }}</h6>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium text-white-dark">
                {{ t('transactions.fields.balanceCompare') }}
              </label>
              <input 
                v-model.number="form.balanceCompare" 
                :disabled="mode === 'view'"
                type="number" 
                step="0.01"
                class="form-input"
                :placeholder="t('transactions.placeholders.previousBalance')"
              />
            </div>
            <div>
              <label class="text-sm font-medium text-white-dark">
                {{ t('accounts.fields.availableLimit') }}
              </label>
              <input 
                v-model.number="form.availableLimit" 
                :disabled="mode === 'view'"
                type="number" 
                step="0.01"
                class="form-input"
                :placeholder="t('transactions.placeholders.limit')"
              />
            </div>
            <div>
              <label class="text-sm font-medium text-white-dark">
                {{ t('transactions.fields.availableLimitCompare') }}
              </label>
              <input 
                v-model.number="form.availableLimitCompare" 
                :disabled="mode === 'view'"
                type="number" 
                step="0.01"
                class="form-input"
                :placeholder="t('transactions.placeholders.previousLimit')"
              />
            </div>
            <div>
              <label class="text-sm font-medium text-white-dark">
                {{ t('transactions.fields.increaseCreditLimit') }}
              </label>
              <input 
                v-model.number="form.increaseCreditLimit" 
                :disabled="mode === 'view'"
                type="number" 
                step="0.01"
                class="form-input"
                :placeholder="t('transactions.placeholders.increaseAmount')"
              />
            </div>
          </div>
          
          <div>
            <label class="text-sm font-medium text-white-dark">
              {{ t('transactions.fields.usedPercent') }}
            </label>
            <input 
              v-model.number="form.usedPercent" 
              :disabled="mode === 'view'"
              type="number" 
              step="0.01"
              min="0"
              max="100"
              class="form-input"
              placeholder="0-100%"
            />
          </div>
        </div>

        <!-- Classification & Notes Group -->
        <div class="space-y-4">
          <h6 class="text-md font-semibold">{{ t('transactions.form.classificationNotes') }}</h6>
          
          <div>
            <label class="text-sm font-medium text-white-dark">
              {{ t('transactions.fields.categorySummary') }}
            </label>
            <input 
              v-model="form.categorySummary" 
              :disabled="mode === 'view'"
              type="text" 
              class="form-input"
              :placeholder="t('transactions.fields.categorySummary')"
            />
          </div>
          
          <div>
            <label class="text-sm font-medium text-white-dark">
              {{ t('transactions.fields.note') }}
            </label>
            <textarea 
              v-model="form.note" 
              :disabled="mode === 'view'"
              class="form-textarea"
              rows="3"
              :placeholder="t('transactions.placeholders.note')"
            ></textarea>
          </div>
          
          <div>
            <label class="text-sm font-medium text-white-dark">
              {{ t('transactions.fields.group') }}
            </label>
            <input 
              v-model="form.group" 
              :disabled="mode === 'view'"
              type="text" 
              class="form-input"
              :placeholder="t('transactions.placeholders.group')"
            />
          </div>
          
          <div>
            <label class="text-sm font-medium text-white-dark">
              {{ t('transactions.fields.importFrom') }}
            </label>
            <input 
              v-model="form.importFrom" 
              :disabled="mode === 'view'"
              type="text" 
              class="form-input"
              :placeholder="t('transactions.placeholders.importFrom')"
            />
          </div>
        </div>

        <!-- Sync & Metadata Group -->
        <div class="space-y-4">
          <h6 class="text-md font-semibold">{{ t('transactions.form.syncMetadata') }}</h6>
          
          <div>
            <label class="text-sm font-medium text-white-dark">
              {{ t('transactions.fields.transactionCode') }}
            </label>
            <input 
              v-model="form.transactionCode" 
              :disabled="mode === 'view'"
              type="text" 
              class="form-input"
              :placeholder="t('transactions.fields.transactionCode')"
            />
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label class="flex items-center">
              <input 
                v-model="form.syncMisa" 
                :disabled="mode === 'view'"
                type="checkbox" 
                class="form-checkbox"
              />
              <span class="ml-2">{{ t('transactions.fields.syncMisa') }}</span>
            </label>
            <label class="flex items-center">
              <input 
                v-model="form.syncSms" 
                :disabled="mode === 'view'"
                type="checkbox" 
                class="form-checkbox"
              />
              <span class="ml-2">{{ t('transactions.fields.syncSms') }}</span>
            </label>
            <label class="flex items-center">
              <input 
                v-model="form.vn" 
                :disabled="mode === 'view'"
                type="checkbox" 
                class="form-checkbox"
              />
              <span class="ml-2">VN</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      
      <!-- Create/Edit Mode Actions -->
      <div v-if="mode !== 'view'" class="flex gap-2 pt-5 border-t dark:border-[#1b2e4b]">
        <button 
          type="submit" 
          :disabled="isLoading"
          class="btn btn-outline-primary flex-1"
        >
          <icon-save class="w-4 h-4" />
          {{ mode === 'create' ? t('common.create') : t('common.update') }}
        </button>
        <button 
          type="button" 
          @click="handleClose"
          class="btn btn-outline-danger"
        >
          {{ t('common.cancel') }}
        </button>
      </div>

      <!-- View Mode Actions -->
      <div v-else class="flex gap-2 pt-5 border-t dark:border-[#1b2e4b]">
        <button 
          type="button" 
          @click="$emit('edit')"
          class="btn btn-warning flex-1"
        >
          <icon-edit class="w-4 h-4" />
          {{ t('common.edit') }}
        </button>
        <button 
          type="button" 
          @click="confirmDelete"
          class="btn btn-danger"
        >
          <icon-trash class="w-4 h-4" />
          {{ t('common.delete') }}
        </button>
        <button 
          type="button" 
          @click="handleClose"
          class="btn btn-outline-secondary"
        >
          {{ t('common.close') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'
import type { TransactionViewModel, TransactionCreateRequest, TransactionUpdateRequest, TransactionDirectionType } from '~/types/transaction'
import type { AccountSelection } from '~/types/account'
import type { ApiError } from '~/types/api'
import { CategoryTypeConst, TransactionDirectionConst } from '~/types/transaction'
import { getCategoryTypeValue, toTransactionErrorState } from '~/composables/useTransactions'

// Props
interface Props {
  visible: boolean
  transaction?: TransactionViewModel | null
  accounts: readonly AccountSelection[]
  mode: 'create' | 'edit' | 'view'
  defaultDirection?: TransactionDirectionType
  defaultAccountId?: string
}

const props = withDefaults(defineProps<Props>(), {
  transaction: null,
  defaultDirection: TransactionDirectionConst.Spent,
  defaultAccountId: ''
})

// Emits
const emit = defineEmits<{
  'update:visible': [value: boolean]
  'created': []
  'updated': []
  'deleted': []
  'edit': []
}>()

// Composables
const { t } = useI18n()
const { createTransaction, updateTransaction, deleteTransaction, createFormDefaults, resetForm } = useTransactions()

// State
const isLoading = ref(false)
// Holds a key or a backend message, never translated text, so it follows a locale switch.
const error = ref<Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null>(null)
const showAdvanced = ref(false)
const formRef = ref<HTMLFormElement | null>(null)

const errorText = computed(() =>
  error.value?.messageKey ? t(error.value.messageKey, error.value.messageParams ?? {}) : error.value?.message ?? ''
)

// Form state
const form = ref<TransactionCreateRequest>({
  accountId: '',
  transactionDate: new Date().toISOString().slice(0, 16), // Format for datetime-local input
  transactionDirection: TransactionDirectionConst.Spent,
  amount: 0,
  description: '',
  balance: 0,
  categoryType: CategoryTypeConst.Expense,
  syncMisa: false,
  syncSms: false,
  vn: true,
  balanceCompare: undefined,
  availableLimit: undefined,
  availableLimitCompare: undefined,
  transactionCode: undefined,
  categorySummary: undefined,
  note: undefined,
  importFrom: undefined,
  increaseCreditLimit: undefined,
  usedPercent: undefined,
  group: undefined
})

// Keyboard event handler
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    handleClose()
  } else if (event.key === 'Enter' && event.ctrlKey && props.mode !== 'view') {
    handleSubmit()
  }
}

// Methods
const handleClose = () => {
  emit('update:visible', false)
}

const initializeForm = () => {
  error.value = null
  showAdvanced.value = false

  if (props.mode === 'create') {
    // Create mode - use defaults
    const defaults = createFormDefaults(props.defaultDirection, props.defaultAccountId)
    Object.assign(form.value, defaults)
    // Ensure datetime format for create mode
    form.value.transactionDate = new Date().toISOString().slice(0, 16)
    
    // Set accountId with validation
    let accountIdToSet = props.defaultAccountId || ''
    
    // If defaultAccountId is provided, verify it exists in accounts list
    if (accountIdToSet && props.accounts.length > 0) {
      const accountExists = props.accounts.some(account => account.id === accountIdToSet)
      if (!accountExists) {
        // If account doesn't exist, use first available account
        accountIdToSet = props.accounts.length > 0 ? props.accounts[0].id : ''
      }
    }
    
    form.value.accountId = accountIdToSet
    
    // Set categoryType based on direction
    form.value.categoryType = props.defaultDirection === TransactionDirectionConst.Revenue 
      ? CategoryTypeConst.Income 
      : CategoryTypeConst.Expense
  } else if (props.transaction) {
    // Edit or View mode - populate from transaction
    const transactionDate = new Date(props.transaction.transactionDate).toISOString().slice(0, 16)
    
    form.value = {
      id: props.transaction.id,
      accountId: props.transaction.accountId,
      userId: props.transaction.userId,
      transactionDate: transactionDate, // Format datetime for input
      transactionDirection: props.transaction.revenueAmount > 0 ? TransactionDirectionConst.Revenue : TransactionDirectionConst.Spent,
      amount: props.transaction.revenueAmount > 0 ? props.transaction.revenueAmount : props.transaction.spentAmount,
      description: props.transaction.description || '',
      balance: props.transaction.balance,
      balanceCompare: props.transaction.balanceCompare,
      availableLimit: props.transaction.availableLimit,
      availableLimitCompare: props.transaction.availableLimitCompare,
      transactionCode: props.transaction.transactionCode,
      syncMisa: props.transaction.syncMisa,
      syncSms: props.transaction.syncSms,
      vn: props.transaction.vn,
      categorySummary: props.transaction.categorySummary,
      note: props.transaction.note,
      importFrom: props.transaction.importFrom,
      increaseCreditLimit: props.transaction.increaseCreditLimit,
      usedPercent: props.transaction.usedPercent,
      // The backend sends the enum name; the select options hold the numeric values. An unknown value stays as sent.
      categoryType: getCategoryTypeValue(props.transaction.categoryType) ?? props.transaction.categoryType,
      group: props.transaction.group
    } as TransactionCreateRequest
  }
}

// The form is novalidate so the message follows the app locale instead of the browser language;
// the browser still evaluates each control's required/min/max/step rules.
const getValidationError = (field: HTMLInputElement): Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> => {
  const { validity, min, max } = field
  if (validity.valueMissing) return { messageKey: 'common.validation.required', message: '' }
  if (validity.rangeUnderflow) return { messageKey: 'common.validation.min', messageParams: { min }, message: '' }
  if (validity.rangeOverflow) return { messageKey: 'common.validation.max', messageParams: { max }, message: '' }
  return { messageKey: 'common.validation.invalid', message: '' }
}

const handleSubmit = async () => {
  // No form while a request is running, so a repeated Ctrl+Enter does not submit twice.
  if (!formRef.value) return
  const invalidField = formRef.value.querySelector<HTMLInputElement>(':invalid')
  if (invalidField) {
    error.value = getValidationError(invalidField)
    invalidField.focus()
    return
  }

  try {
    isLoading.value = true
    error.value = null

    if (props.mode === 'create') {
      await createTransaction(form.value)
      resetForm(form.value)
      emit('created')
    } else if (props.mode === 'edit') {
      await updateTransaction(form.value as TransactionUpdateRequest)
      emit('updated')
    }
  } catch (err) {
    error.value = toTransactionErrorState(err, 'common.errors.unknown')
  } finally {
    isLoading.value = false
  }
}

const confirmDelete = async () => {
  if (!props.transaction) return
  // The panel can close while the dialog is open, so keep what the dialog was about.
  const { id, description } = props.transaction

  const result = await Swal.fire({
    title: t('common.confirmation.title'),
    text: t('transactions.confirm.delete', { description: description || t('transactions.confirm.noDescription') }),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: t('common.confirmation.yesDelete'),
    cancelButtonText: t('common.cancel')
  })

  if (result.isConfirmed) {
    try {
      isLoading.value = true
      await deleteTransaction(id)
      emit('deleted')
    } catch (err) {
      error.value = toTransactionErrorState(err, 'transactions.errors.deleteFailed')
    } finally {
      isLoading.value = false
    }
  }
}

// Watchers
watch(() => props.visible, (newVal) => {
  if (newVal) {
    initializeForm()
  }
})

watch(() => props.mode, () => {
  if (props.visible) {
    initializeForm()
  }
})

watch(() => props.transaction, () => {
  if (props.visible) {
    initializeForm()
  }
})

watch(() => props.defaultAccountId, (newVal) => {
  if (props.visible && props.mode === 'create' && newVal) {
    form.value.accountId = newVal
  }
})

// Re-initialize form when accounts are loaded (for create mode)
watch(() => props.accounts, (newAccounts, oldAccounts) => {
  if (props.visible && props.mode === 'create' && newAccounts.length > 0 && oldAccounts.length === 0) {
    initializeForm()
  }
})

// Auto-update categoryType when transactionDirection changes
watch(() => form.value.transactionDirection, (newDirection) => {
  if (props.mode === 'create') {
    form.value.categoryType = newDirection === TransactionDirectionConst.Revenue 
      ? CategoryTypeConst.Income 
      : CategoryTypeConst.Expense
  }
})

// Lifecycle
onMounted(() => {
  if (props.visible) {
    initializeForm()
  }
  
  // Add keyboard listener
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  // Remove keyboard listener
  window.removeEventListener('keydown', handleKeydown)
})
</script> 
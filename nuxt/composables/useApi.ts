import { logger } from '~/utils/logger'
import type { ApiError } from '~/types'

export const useApi = () => {
  const config = useRuntimeConfig()
  const baseURL = config.public.apiBase
  const authStore = useAuthStore()

  /**
   * Generic API call wrapper with error handling and authentication
   */
  const apiCall = async <T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
      body?: any
      query?: Record<string, any>
      isFormData?: boolean
      signal?: AbortSignal
    } = {}
  ): Promise<T> => {
    const requestToken = authStore.token
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      }

      // Add authentication headers if user is authenticated
      if (authStore.isAuthenticated && requestToken) {
        headers['Authorization'] = `Bearer ${requestToken}`
      }

      let body = options.body

      // Convert to FormData if needed
      if (options.isFormData && body && typeof body === 'object') {
        const formData = ConvertObjectToFormData(body, new FormData());

        body = formData
        // Don't set Content-Type for FormData, let browser set it with boundary
      } else {
        headers['Content-Type'] = 'application/json'
      }

      // Use native fetch for FormData to avoid issues with $fetch
      if (options.isFormData) {
        const url = new URL(`${baseURL}${endpoint}`)
        if (options.query) {
          Object.keys(options.query).forEach(key => {
            url.searchParams.append(key, options.query![key])
          })
        }
        const response = await fetch(url.toString(), {
          method: options.method || 'GET',
          body,
          headers,
          signal: options.signal
        }).catch((error: any) => {
          // fetch rejects only when no response arrived: an abort, or a network failure.
          if (options.signal?.aborted || error?.name === 'AbortError') {
            throw error
          }
          throw {
            message: 'Network error. Please check your connection.',
            messageKey: 'common.errors.network',
            statusCode: 0
          } as ApiError
        })

        if (!response.ok) {
          // Check for 401 Unauthorized - token expired
          if (response.status === 401 && authStore.token === requestToken) {
            logger.dev('401 Unauthorized (FormData) - clearing current authentication')
            authStore.clearAuthState()
            await navigateTo('/auth/login')
          }

          const errorData = await response.json().catch(() => ({}))
          throw {
            message: response.status === 401 ? 'Your session has expired. Please login again.' : (errorData.message || 'An error occurred'),
            messageKey: response.status === 401 ? 'common.errors.sessionExpired' : (errorData.message ? undefined : 'common.errors.unknown'),
            statusCode: response.status,
            errors: errorData.errors
          } as ApiError
        }

        return await response.json()
      } else {
        const response = await $fetch<T>(`${baseURL}${endpoint}`, {
          method: options.method || 'GET',
          body,
          query: options.query,
          headers,
          signal: options.signal
        })
        return response
      }
    } catch (error: any) {
      if (options.signal?.aborted || error?.name === 'AbortError' || error?.cause?.name === 'AbortError') {
        throw error
      }

      // Keep native-fetch ApiError responses intact, including validation/conflict statuses.
      if (!error.response && typeof error?.statusCode === 'number' && typeof error?.message === 'string') {
        throw error
      }

      // Handle different types of errors
      if (error.response) {
        // Check for 401 Unauthorized - token expired
        if (error.response.status === 401) {
          if (authStore.token === requestToken) {
            logger.dev('401 Unauthorized - clearing current authentication')
            authStore.clearAuthState()
            await navigateTo('/auth/login')
          }

          // Still throw the error for the calling component to handle if needed
          const apiError: ApiError = {
            message: 'Your session has expired. Please login again.',
            messageKey: 'common.errors.sessionExpired',
            statusCode: 401,
            errors: error.response._data?.errors
          }
          throw apiError
        }

        // Server responded with other error status
        const apiError: ApiError = {
          message: error.response._data?.message || 'An error occurred',
          messageKey: error.response._data?.message ? undefined : 'common.errors.unknown',
          statusCode: error.response.status,
          errors: error.response._data?.errors
        }
        throw apiError
      } else if (error.request) {
        // Network error
        throw {
          message: 'Network error. Please check your connection.',
          messageKey: 'common.errors.network',
          statusCode: 0
        } as ApiError
      } else {
        // Other error
        throw {
          message: error.message || 'An unexpected error occurred',
          messageKey: 'common.errors.unknown',
          statusCode: 500
        } as ApiError
      }
    }
  }

  /**
   * GET request
   */
  const get = <T>(endpoint: string, query?: Record<string, any>, signal?: AbortSignal): Promise<T> => {
    return apiCall<T>(endpoint, { method: 'GET', query, signal })
  }

  /**
   * POST request
   */
  const post = <T>(endpoint: string, body?: any, signal?: AbortSignal): Promise<T> => {
    return apiCall<T>(endpoint, { method: 'POST', body, signal })
  }

  /**
   * POST request with form data
   */
  const postForm = <T>(endpoint: string, body?: any): Promise<T> => {
    return apiCall<T>(endpoint, { method: 'POST', body, isFormData: true })
  }

  /**
   * PUT request
   */
  const put = <T>(endpoint: string, body?: any): Promise<T> => {
    return apiCall<T>(endpoint, { method: 'PUT', body })
  }

  /**
   * PUT request with form data
   */
  const putForm = <T>(endpoint: string, body?: any): Promise<T> => {
    return apiCall<T>(endpoint, { method: 'PUT', body, isFormData: true })
  }

  /**
   * DELETE request
   */
  const del = <T>(endpoint: string): Promise<T> => {
    return apiCall<T>(endpoint, { method: 'DELETE' })
  }

  return {
    apiCall,
    get,
    post,
    postForm,
    put,
    putForm,
    delete: del
  }
}
const ConvertObjectToFormData = (
  object: any,
  formData = new FormData(),
  namespace: string | undefined = undefined
): FormData => {
  for (let property in object) {
    if (!object.hasOwnProperty(property) || !object[property]) {
      continue;
    }
    const formKey = namespace ? `${namespace}[${property}]` : property;
    if (object[property] instanceof Date) {
      formData.append(formKey, object[property].toISOString());
    } else if (
      typeof object[property] === 'object' &&
      !(object[property] instanceof File)
    ) {
      ConvertObjectToFormData(object[property], formData, formKey);
    } else {
      formData.append(formKey, object[property]);
    }
  }
  return formData;
};
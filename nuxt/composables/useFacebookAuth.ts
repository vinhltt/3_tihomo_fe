import { logger } from '~/utils/logger'
import { ref, computed } from 'vue'
import type { SocialLoginRequest, SocialLoginResponse } from '@/types/auth'
import type { ApiError } from '@/types/api'

// A frontend message carries messageKey so the page can translate it; the English message stays for logs.
const facebookError = (messageKey: string, message: string): Error & Pick<ApiError, 'messageKey' | 'messageParams'> =>
  Object.assign(new Error(message), { messageKey, messageParams: { provider: 'Facebook' } })

/**
 * Facebook Authentication composable for handling Facebook Login (EN)
 * Composable xác thực Facebook để xử lý đăng nhập Facebook (VI)
 */
export const useFacebookAuth = () => {
  const config = useRuntimeConfig()
  const isLoading = ref(false)
  // Display error shape: a frontend message carries messageKey, a backend message is kept verbatim.
  const error = ref<Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null>(null)
  
  // Check if Facebook app ID is configured
  const isConfigured = computed(() => {
    const appId = config.public.facebookAppId
    return appId && appId !== 'your-facebook-app-id-here'
  })

  /**
   * Initialize Facebook SDK (EN)
   * Khởi tạo Facebook SDK (VI)
   */
  const initializeFacebook = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!isConfigured.value) {
        reject(facebookError('auth.errors.providerNotConfigured', 'Facebook App ID not configured'))
        return
      }

      // Check if Facebook SDK is already loaded
      if (window.FB) {
        resolve()
        return
      }

      // Load Facebook SDK
      const script = document.createElement('script')
      script.src = 'https://connect.facebook.net/en_US/sdk.js'
      script.async = true
      script.defer = true
      script.onload = () => {
        window.fbAsyncInit = () => {
          if (window.FB) {
            window.FB.init({
              appId: config.public.facebookAppId,
              cookie: true,
              xfbml: true,
              version: 'v19.0'
            })
          }
          resolve()
        }
        
        // Trigger fbAsyncInit if it exists
        if (window.fbAsyncInit) {
          window.fbAsyncInit()
        }
      }
      script.onerror = () => {
        reject(facebookError('auth.errors.sdkLoadFailed', 'Failed to load Facebook SDK'))
      }
      document.head.appendChild(script)
    })
  }

  /**
   * Sign in with Facebook (EN)
   * Đăng nhập bằng Facebook (VI)
   */
  const signIn = (): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        isLoading.value = true
        error.value = null

        if (!isConfigured.value) {
          throw facebookError('auth.errors.providerNotConfigured', 'Facebook authentication not configured')
        }

        await initializeFacebook()

        if (!window.FB) {
          throw facebookError('auth.errors.sdkNotLoaded', 'Facebook SDK not loaded')
        }        // Check current login status
        window.FB.getLoginStatus((response: any) => {
          if (response.status === 'connected') {
            // User is already logged in
            resolve(response.authResponse.accessToken)
          } else {
            // User needs to log in
            if (window.FB) {
              window.FB.login((loginResponse: any) => {
                if (loginResponse.authResponse) {
                  resolve(loginResponse.authResponse.accessToken)
                } else {
                  reject(facebookError('auth.errors.cancelled', 'Facebook login was cancelled or failed'))
                }
              }, { scope: 'email' })
            } else {
              reject(facebookError('auth.errors.sdkNotLoaded', 'Facebook SDK not available'))
            }
          }
        })

      } catch (err: any) {
        error.value = err?.messageKey
          ? { messageKey: err.messageKey, messageParams: err.messageParams, message: err.message }
          : { messageKey: 'auth.errors.providerFailed', messageParams: { provider: 'Facebook' }, message: err?.message || 'Facebook sign-in failed' }
        reject(err)
      } finally {
        isLoading.value = false
      }
    })
  }
  /**
   * Send Facebook token to our Identity API (EN)
   * Gửi token Facebook đến Identity API của chúng ta (VI)
   */
  const authenticateWithAPI = async (facebookToken: string): Promise<SocialLoginResponse> => {
    logger.dev('🔐 Authenticating with API via Gateway (Facebook token)')
    
    // Call through API Gateway instead of direct service call
      const rawResponse = await $fetch('/api/identity/auth/social-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          Provider: 'Facebook',
          Token: facebookToken
        } as SocialLoginRequest,
        ignoreResponseError: true
      })

      logger.dev('🔍 Raw API Response received (Facebook):', {
        hasResponse: !!rawResponse,
        responseType: typeof rawResponse,
        responseKeys: rawResponse ? Object.keys(rawResponse) : []
      })

      // Handle different response formats
      let response: SocialLoginResponse
      
      if (!rawResponse) {
        throw facebookError('auth.errors.emptyResponse', 'Empty response from API')
      }

      if ('data' in rawResponse && typeof rawResponse.data === 'object') {
        response = rawResponse.data as SocialLoginResponse
        logger.dev('✅ Facebook: Response wrapped in data structure')
      } else {
        response = rawResponse as SocialLoginResponse
        logger.dev('✅ Facebook: Direct response structure')
      }

      if (!response.accessToken) {
        throw facebookError('auth.errors.missingAccessToken', 'Access token missing from Facebook API response')
      }

    return response
  }

  /**
   * Complete Facebook authentication flow (EN)
   * Hoàn thành quy trình xác thực Facebook (VI)
   */
  const login = async (): Promise<SocialLoginResponse> => {
    try {
      isLoading.value = true
      error.value = null

      // Step 1: Get Facebook token
      const facebookToken = await signIn()
      
      // Step 2: Exchange for our JWT
      const authResponse = await authenticateWithAPI(facebookToken)
      
      return authResponse
    } catch (err: any) {
      error.value = err?.messageKey
        ? { messageKey: err.messageKey, messageParams: err.messageParams, message: err.message }
        : { messageKey: 'auth.errors.providerFailed', messageParams: { provider: 'Facebook' }, message: err?.message || 'Facebook authentication failed' }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Logout from Facebook (EN)
   * Đăng xuất khỏi Facebook (VI)
   */
  const logout = (): Promise<void> => {
    return new Promise((resolve) => {
      if (window.FB) {
        window.FB.logout(() => {
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  return {
    isLoading: readonly(isLoading),
    error: readonly(error),
    isConfigured,
    login,
    logout,
    initializeFacebook
  }
}

// Global type declarations for Facebook SDK
declare global {
  interface Window {
    FB?: {
      init: (config: any) => void
      getLoginStatus: (callback: (response: any) => void) => void
      login: (callback: (response: any) => void, options?: any) => void
      logout: (callback: () => void) => void
      api: (path: string, callback: (response: any) => void) => void
    }
    fbAsyncInit?: () => void
  }
}

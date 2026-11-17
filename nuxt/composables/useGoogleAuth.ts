import { logger } from '~/utils/logger'
import { ref, computed } from 'vue'
import type { SocialLoginRequest, SocialLoginResponse } from '@/types/auth'
import type { ApiError } from '@/types/api'

// A frontend message carries messageKey so the page can translate it; the English message stays for logs.
const googleError = (messageKey: string, message: string): Error & Pick<ApiError, 'messageKey' | 'messageParams'> =>
  Object.assign(new Error(message), { messageKey, messageParams: { provider: 'Google' } })

/**
 * Google Authentication composable for handling Google Sign-In (EN)
 * Composable xác thực Google để xử lý đăng nhập Google (VI)
 */
export const useGoogleAuth = () => {
  const config = useRuntimeConfig()
  const isLoading = ref(false)
  // Display error shape: a frontend message carries messageKey, a backend message is kept verbatim.
  const error = ref<Pick<ApiError, 'messageKey' | 'messageParams' | 'message'> | null>(null)
  
  // Check if Google client ID is configured
  const isConfigured = computed(() => {
    const clientId = config.public.googleClientId
    return clientId && clientId !== 'your-google-client-id-here'
  })

  /**
   * Initialize Google Sign-In SDK (EN)
   * Khởi tạo Google Sign-In SDK (VI)
   */
  const initializeGoogle = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!isConfigured.value) {
        reject(googleError('auth.errors.providerNotConfigured', 'Google Client ID not configured'))
        return
      }

      // Check if Google SDK is already loaded
      if (window.google && window.google.accounts) {
        resolve()
        return
      }      // Load Google SDK
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => {
        // Initialize Google Sign-In
        if (window.google?.accounts?.id) {
          window.google.accounts.id.initialize({
            client_id: config.public.googleClientId,
            callback: () => {}, // Will be overridden in signIn method
            auto_select: false,
            cancel_on_tap_outside: true
          })
        }
        resolve()
      }
      script.onerror = () => {
        reject(googleError('auth.errors.sdkLoadFailed', 'Failed to load Google SDK'))
      }
      document.head.appendChild(script)
    })
  }
  /**
   * Sign in with Google (EN)
   * Đăng nhập bằng Google (VI)
   */
  const signIn = (): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        isLoading.value = true
        error.value = null

        if (!isConfigured.value) {
          throw googleError('auth.errors.providerNotConfigured', 'Google authentication not configured')
        }

        await initializeGoogle()

        // Use Google Sign-In for ID token (JWT format)
        if (window.google?.accounts?.id) {
          // Set callback for credential response
          window.google.accounts.id.initialize({
            client_id: config.public.googleClientId,
            callback: (response: any) => {
              logger.dev('🎯 Google credential response (ID token):', {
                hasCredential: !!response.credential,
                credentialLength: response.credential?.length || 0,
                credentialPreview: response.credential?.substring(0, 50) + '...'
              })
              
              if (response.credential) {
                // This is the Google ID token (JWT format) that backend expects
                resolve(response.credential)
              } else {
                reject(googleError('auth.errors.noCredential', 'No credential received from Google'))
              }
            }
          })

          // Try One Tap first, then fallback to renderButton
          window.google.accounts.id.prompt((notification: any) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              // Create a temporary button for sign-in
              const tempDiv = document.createElement('div')
              tempDiv.style.display = 'none'
              document.body.appendChild(tempDiv)
              
              window.google?.accounts?.id.renderButton(tempDiv, {
                type: 'standard',
                shape: 'rectangular',
                theme: 'outline',
                text: 'signin_with',
                size: 'large',
                logo_alignment: 'left',
                click_listener: () => {
                  // Button will trigger the callback automatically
                }
              })
              
              // Auto-click the button
              setTimeout(() => {
                const button = tempDiv.querySelector('div[role="button"]') as HTMLElement
                if (button) {
                  button.click()
                }
                document.body.removeChild(tempDiv)
              }, 100)
            }
          })
        } else {
          throw googleError('auth.errors.sdkNotLoaded', 'Google SDK not loaded')
        }

      } catch (err: any) {
        error.value = err?.messageKey
          ? { messageKey: err.messageKey, messageParams: err.messageParams, message: err.message }
          : { messageKey: 'auth.errors.providerFailed', messageParams: { provider: 'Google' }, message: err?.message || 'Google sign-in failed' }
        reject(err)
      } finally {
        isLoading.value = false
      }
    })
  }

  /**
   * Send Google token to our Identity API (EN)
   * Gửi token Google đến Identity API của chúng ta (VI)
   */  const authenticateWithAPI = async (googleToken: string): Promise<SocialLoginResponse> => {
    logger.dev('🔐 Authenticating with API via Gateway (ID token):', {
      provider: 'Google',
      tokenLength: googleToken?.length || 0,
      tokenPreview: googleToken?.substring(0, 50) + '...'
    })
    
    try {      // Call through API Gateway instead of direct service call
      const rawResponse = await $fetch('/api/identity/auth/social-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          Provider: 'Google',
          Token: googleToken
        } as SocialLoginRequest,
        // Don't throw on HTTP errors, handle them manually
        ignoreResponseError: true
      })

      logger.dev('🔍 Raw API Response received:', {
        hasResponse: !!rawResponse,
        responseType: typeof rawResponse,
        responseKeys: rawResponse ? Object.keys(rawResponse) : [],
        fullResponse: rawResponse ? JSON.stringify(rawResponse, null, 2) : 'NO RESPONSE'
      })

      // Handle different response formats
      let response: SocialLoginResponse
      
      if (!rawResponse) {
        throw googleError('auth.errors.emptyResponse', 'Empty response from API')
      }

      // Check if response is wrapped in { data: ... } structure
      if ('data' in rawResponse && typeof rawResponse.data === 'object') {
        response = rawResponse.data as SocialLoginResponse
        logger.dev('✅ Response wrapped in data structure')
      } else {
        // Direct response
        response = rawResponse as SocialLoginResponse
        logger.dev('✅ Direct response structure')
      }

      // Validate required fields
      if (!response.accessToken) {
        throw googleError('auth.errors.missingAccessToken', 'Access token missing from API response')
      }

      logger.dev('✅ API Authentication successful - Full response:', {
          hasAccessToken: !!response.accessToken,
          hasUser: !!response.user,
          hasRefreshToken: !!response.refreshToken,
          userEmail: response.user?.email,
          fullResponse: JSON.stringify(response, null, 2),
          responseKeys: Object.keys(response),
          responseTypes: Object.fromEntries(
            Object.keys(response).map(key => [key, typeof response[key]])
          )
        })

      return response
    } catch (error: any) {
      logger.error('❌ API Authentication failed:', error)
      throw error;
    }
  }

  /**
   * Complete Google authentication flow (EN)
   * Hoàn thành quy trình xác thực Google (VI)
   */
  const login = async (): Promise<SocialLoginResponse> => {
    try {
      isLoading.value = true
      error.value = null

      // Step 1: Get Google ID token (JWT)
      const googleToken = await signIn()
      
      // Step 2: Exchange for our JWT
      const authResponse = await authenticateWithAPI(googleToken)
      
      return authResponse
    } catch (err: any) {
      error.value = err?.messageKey
        ? { messageKey: err.messageKey, messageParams: err.messageParams, message: err.message }
        : { messageKey: 'auth.errors.providerFailed', messageParams: { provider: 'Google' }, message: err?.message || 'Google authentication failed' }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading: readonly(isLoading),
    error: readonly(error),
    isConfigured,
    login,
    initializeGoogle
  }
}

// Global type declarations for Google SDK
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void
          prompt: (callback?: (notification: any) => void) => void
          renderButton: (element: HTMLElement, config: any) => void
        }
        oauth2: {
          initTokenClient: (config: any) => {
            requestAccessToken: () => void
          }
        }
      }
    }
  }
}

/**
 * ESLint Configuration for TiHoMo Secure Logging (EN)
 * Cấu hình ESLint cho Logging Bảo mật TiHoMo (VI)
 * 
 * @see https://eslint.org/docs/user-guide/configuring
 */

module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    "plugin:@typescript-eslint/recommended",
    "plugin:nuxt/recommended",
    "plugin:vue/vue3-recommended",
  ],
  parserOptions: {
    ecmaVersion: "latest",
    parser: "@typescript-eslint/parser",
    sourceType: "module",
  },
  plugins: [
    "@typescript-eslint",
    "tihomo-security"
  ],
  rules: {
    // Existing rules
    "max-len": [2, { code: 210, tabWidth: 4, ignoreUrls: true }],
    "vue/prop-name-casing": ["error"],
    "vue/multi-word-component-names": 0,
    
    // ============================================================
    // Security Rules: Console Logging Protection (EN)
    // Quy tắc Bảo mật: Bảo vệ Console Logging (VI)
    // ============================================================
    
    /**
     * Rule: no-console (EN)
     * Quy tắc: no-console (VI)
     * 
     * Prevents direct console.log usage in production code.
     * Use logger utility instead: logger.dev(), logger.info(), etc.
     * 
     * Ngăn sử dụng console.log trực tiếp trong production code.
     * Sử dụng logger utility thay vì: logger.dev(), logger.info(), v.v.
     */
    "no-console": ["error", {
      allow: [] // No exceptions - must use logger utility
    }],
    
    /**
     * Rule: tihomo-security/no-sensitive-logging (EN)
     * Quy tắc: tihomo-security/no-sensitive-logging (VI)
     * 
     * Detects potentially sensitive variable names in logging.
     * Triggers on: password, token, credential, cardNumber, ssn, etc.
     * 
     * Phát hiện tên biến có thể nhạy cảm trong logging.
     * Kích hoạt với: password, token, credential, cardNumber, ssn, v.v.
     */
    "tihomo-security/no-sensitive-logging": "error",
    
    /**
     * Rule: no-debugger (EN)
     * Quy tắc: no-debugger (VI)
     * 
     * Prevents debugger statements in production.
     * 
     * Ngăn debugger statements trong production.
     */
    "no-debugger": "error"
  },
  
  /**
   * Override rules for test files (EN)
   * Ghi đè quy tắc cho test files (VI)
   * 
   * Test files can use console for debugging.
   * Test files có thể dùng console để debug.
   */
  overrides: [
    {
      files: [
        "tests/**/*.{js,ts}",
        "**/*.test.{js,ts}",
        "**/*.spec.{js,ts}",
        "vitest.config.ts",
        "tests/setup.ts"
      ],
      rules: {
        "no-console": "off",
        "tihomo-security/no-sensitive-logging": "warn" // Warn only in tests
      }
    }
  ]
};

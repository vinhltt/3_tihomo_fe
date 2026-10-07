export default defineNuxtConfig({
    app: {
        head: {
            title: 'Sales Admin | VRISTO - Multipurpose Tailwind Dashboard Template',
            titleTemplate: '%s | VRISTO - Multipurpose Tailwind Dashboard Template',
            htmlAttrs: {
                lang: 'en',
            },
            meta: [
                { charset: 'utf-8' },
                {
                    name: 'viewport',
                    content: 'width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no',
                },
                { hid: 'description', name: 'description', content: '' },
                { name: 'format-detection', content: 'telephone=no' },
            ],
            link: [
                { rel: 'icon', type: 'image/x-icon', href: '/favicon.png' },
                {
                    rel: 'stylesheet',
                    href: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap',
                },
            ],
        },
    },

    css: ['~/assets/css/app.css'],

    postcss: {
        plugins: {
            tailwindcss: {},
            autoprefixer: {},
        },
    },

    modules: ['@pinia/nuxt', '@nuxtjs/i18n'],

    i18n: {
        locales: [
            { code: 'en', file: 'en.json' },
            { code: 'vi', file: 'vi.json' },
        ],
        lazy: true,
        defaultLocale: 'en',
        strategy: 'no_prefix',
        langDir: 'locales/',
    },

    // ============================================================
    // Vite Configuration for Secure Logging (EN)
    // Cấu hình Vite cho Logging Bảo mật (VI)
    // ============================================================
    vite: {
        optimizeDeps: { include: ['quill'] },
        
        /**
         * Build configuration for production (EN)
         * Cấu hình build cho production (VI)
         * 
         * Strips all console statements and debugger in production builds
         * for security and performance.
         * 
         * Xóa tất cả console statements và debugger trong production builds
         * để bảo mật và hiệu suất.
         */
        esbuild: {
            drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
        },
        
        /**
         * Build optimization (EN)
         * Tối ưu hóa build (VI)
         */
        build: {
            /**
             * Source map configuration (EN)
             * Cấu hình source map (VI)
             * 
             * - development: 'source-map' for full debugging
             * - production: false to prevent source code exposure
             * 
             * - development: 'source-map' để debug đầy đủ
             * - production: false để ngăn lộ source code
             */
            sourcemap: process.env.NODE_ENV === 'production' ? false : 'source-map',
            
            /**
             * Minification (EN)
             * Nén code (VI)
             */
            minify: 'esbuild',
            
            /**
             * Tree-shaking for logger utility (EN)
             * Tree-shaking cho logger utility (VI)
             */
            rollupOptions: {
                treeshake: {
                    moduleSideEffects: false
                }
            }
        },
        
        /**
         * Environment-specific defines (EN)
         * Định nghĩa theo môi trường (VI)
         * 
         * These are replaced at build time for dead code elimination.
         * Các biến này được thay thế lúc build để loại bỏ dead code.
         */
        define: {
            '__DEV__': process.env.NODE_ENV !== 'production',
            '__PROD__': process.env.NODE_ENV === 'production'
        }
    },

    router: {
        options: { linkExactActiveClass: 'active' },
    },

    compatibilityDate: '2024-09-21',

    devServer: {
        port: {
            port: process.env.FRONTEND_PORT ? parseInt(process.env.FRONTEND_PORT) : 3500,
            alternativePortRange: [],
            random: false,
        } as unknown as number,
    },

    runtimeConfig: {
        // Private keys (only available on server-side)

        // Public keys (exposed to client-side)
        public: {
            apiBase: process.env.API_BASE_URL || 'http://localhost:5000', // API Gateway port
            appBase: process.env.FRONTEND_BASE_URL || 'http://localhost:3500', // Frontend base URL
            googleClientId: process.env.APP_PUBLIC_GOOGLE_CLIENT_ID,
            facebookAppId: process.env.NUXT_PUBLIC_FACEBOOK_APP_ID,
        },
    },
});

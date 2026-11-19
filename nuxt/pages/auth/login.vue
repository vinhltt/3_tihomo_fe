<template>
    <!-- Redirect to cover-login for better UI -->
</template>

<script setup lang="ts">
// Redirect in a route middleware, before this page is set up, so cover-login owns the head and its translated title.
// The router encodes returnUrl once from the query object.
definePageMeta({
    layout: 'auth-layout',
    auth: false, // Disable auth middleware for this page
    middleware: [
        (to) => navigateTo({ path: '/auth/cover-login', query: to.query.returnUrl ? { returnUrl: to.query.returnUrl } : {} }, { replace: true }),
    ],
})
</script>

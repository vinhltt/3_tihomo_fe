export default defineI18nConfig(() => ({
    // No language fallback: a key missing in the active locale renders as the raw key.
    fallbackLocale: false,
}));

import { $themeConfig } from './theme.config';
import { useAppStore } from '@/stores/index';

// Set after the one-time reset to the default locale has run in this browser.
const LOCALE_RESET_MARKER = 'i18n_locale_reset_v1';

/**
 * Reads a value from localStorage; returns null when storage is blocked or unavailable. (EN)
 *
 * Đọc giá trị từ localStorage; trả null khi storage bị chặn hoặc không dùng được. (VI)
 */
export const readStorage = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

/**
 * Writes a value to localStorage; does nothing when storage is blocked or unavailable. (EN)
 *
 * Ghi giá trị vào localStorage; bỏ qua khi storage bị chặn hoặc không dùng được. (VI)
 */
export const writeStorage = (key: string, value: string): void => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Storage blocked: the setting lives in memory for this page only.
    }
};

export default {
    init(setLocale: any) {
        const store = useAppStore();

        // set default styles
        let val: any = readStorage('theme'); // light, dark, system
        val = val || $themeConfig.theme;
        store.toggleTheme(val);

        val = readStorage('menu'); // vertical, collapsible-vertical, horizontal
        val = val || $themeConfig.menu;
        store.toggleMenu(val);

        val = readStorage('layout'); // full, boxed-layout
        val = val || $themeConfig.layout;
        store.toggleLayout(val);

        // The first run resets any saved locale to the default once; later runs honour the saved choice.
        // An unsupported saved code (e.g. fr, ae) falls back to the default, and toggleLocale stores rtlClass=ltr.
        const localeResetDone = readStorage(LOCALE_RESET_MARKER) !== null;
        val = (localeResetDone && readStorage('i18n_locale')) || $themeConfig.locale; // vi, en

        const list = store.languageList;
        const item = list.find((item: any) => item.code === val) || list.find((item: any) => item.code === $themeConfig.locale);
        this.toggleLanguage(item, setLocale);
        if (!localeResetDone) {
            writeStorage(LOCALE_RESET_MARKER, '1');
        }

        val = readStorage('rtlClass'); // rtl, ltr
        val = val || $themeConfig.rtlClass;
        store.toggleRTL(val);

        val = readStorage('animation'); // animate__fadeIn, animate__fadeInDown, animate__fadeInUp, animate__fadeInLeft, animate__fadeInRight, animate__slideInDown, animate__slideInLeft, animate__slideInRight, animate__zoomIn
        val = val || $themeConfig.animation;
        store.toggleAnimation(val);

        val = readStorage('navbar'); // navbar-sticky, navbar-floating, navbar-static
        val = val || $themeConfig.navbar;
        store.toggleNavbar(val);

        val = readStorage('semidark');
        val = val === 'true' ? true : $themeConfig.semidark;
        store.toggleSemidark(val);
    },

    toggleLanguage(item: any, setLocale: any) {
        const store = useAppStore();

        let lang: any = null;
        if (item) {
            lang = item;
        } else {
            let code = store.locale || null;
            if (!code) {
                code = readStorage('i18n_locale');
            }

            item = store.languageList.find((d: any) => d.code === code);
            if (item) {
                lang = item;
            }
        }

        if (!lang) {
            lang = store.languageList.find((d: any) => d.code === 'vi');
        }

        store.toggleLocale(lang.code, setLocale);
        return lang;
    },

    changeAnimation(type = 'add') {
        const store = useAppStore();
        if (store.animation) {
            const eleanimation: any = document.querySelector('.animation');
            if (type === 'add') {
                eleanimation?.classList.add('animate__animated');
                eleanimation?.classList.add(store.animation);
            } else {
                eleanimation?.classList.remove('animate__animated');
                eleanimation?.classList.remove(store.animation);
            }
        }
    },
};

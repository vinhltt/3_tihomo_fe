// Checks the i18n keys of the in-scope screens. Run from the Nuxt root: npm run i18n:check
// Reports, one finding per line:
//   missing-key    a referenced key that is missing in en or vi (file:line)
//   locale-only    a key that exists in only one of the two locale files
//   dynamic-key    a t()/$t() call whose key is a template literal with ${...} (file:line)
// A referenced key is the literal first argument of t(/$t(/te(, or any single-quoted literal that starts with a
// key namespace (enum label maps). Double-quoted literals outside t() are Vue template expressions, not keys.
// Exit codes: 0 no findings, 1 findings, 2 a locale or source file could not be read or parsed.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const LOCALES = ['en', 'vi'];
const NAMESPACES = ['common', 'shell', 'enums', 'accounts', 'transactions', 'recurring', 'expected', 'apiKey', 'auth'];
const SCAN_SET = [
    'pages/apps/accounts',
    'pages/apps/transactions',
    'pages/apps/recurring-transactions',
    'pages/apps/expected-transactions',
    'pages/apps/api-keys',
    'pages/auth/cover-login.vue',
    'pages/auth/login.vue',
    'components/apps',
    'components/api-key',
    'components/layout',
    'components/AccountModal.vue',
    'components/AccountDropdown.vue',
    'components/TransactionList.vue',
    'components/NavigationBreadcrumb.vue',
    'layouts',
    'composables',
    'utils',
    'stores',
    'app-setting.ts',
];
const SOURCE_EXTENSIONS = ['.vue', '.ts'];

// t('key'), $t("key"), te('key'), t(`key`): a literal first argument (template literal without interpolation).
const CALL_KEY_PATTERN = /(?<![\w$])\$?te?\(\s*(?:'([^'\\\r\n]*)'|"([^"\\\r\n]*)"|`([^`\\$]*)`)/g;
// A single-quoted literal in a key namespace, e.g. an enum label map value.
const NAMESPACE_LITERAL_PATTERN = new RegExp(`'((?:${NAMESPACES.join('|')})\\.[^'\\\\\\r\\n]*)'`, 'g');
// t()/$t() whose first argument is a template literal with interpolation.
const DYNAMIC_KEY_PATTERN = /(?<![\w$])\$?t\(\s*`[^`]*?\$\{/g;

const toDisplayPath = (file) => relative(ROOT, file).split(sep).join('/');

const readText = (file) => {
    try {
        return readFileSync(file, 'utf8');
    } catch (error) {
        throw new Error(`cannot read ${toDisplayPath(file)}: ${error.message}`);
    }
};

const flattenKeys = (node, prefix, keys) => {
    for (const [name, value] of Object.entries(node)) {
        const key = prefix ? `${prefix}.${name}` : name;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            flattenKeys(value, key, keys);
        } else {
            keys.add(key);
        }
    }
    return keys;
};

const loadLocaleKeys = (locale) => {
    const file = join(ROOT, 'locales', `${locale}.json`);
    const text = readText(file);
    let messages;
    try {
        messages = JSON.parse(text);
    } catch (error) {
        throw new Error(`cannot parse ${toDisplayPath(file)}: ${error.message}`);
    }
    if (messages === null || typeof messages !== 'object' || Array.isArray(messages)) {
        throw new Error(`cannot parse ${toDisplayPath(file)}: the root is not an object`);
    }
    return flattenKeys(messages, '', new Set());
};

const collectSourceFiles = (entry, files) => {
    const path = join(ROOT, entry);
    let stats;
    try {
        stats = statSync(path);
    } catch (error) {
        throw new Error(`cannot read ${entry}: ${error.message}`);
    }
    if (stats.isDirectory()) {
        const children = readdirSync(path).sort();
        for (const child of children) {
            collectSourceFiles(`${entry}/${child}`, files);
        }
    } else if (SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
        files.add(path);
    }
    return files;
};

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

const collectReferences = (file) => {
    const text = readText(file);
    const references = new Map();
    const dynamicCalls = [];
    const addReference = (key, index) => {
        const line = lineAt(text, index);
        references.set(`${line}\u0000${key}`, { key, line });
    };
    for (const match of text.matchAll(CALL_KEY_PATTERN)) {
        const key = match[1] ?? match[2] ?? match[3];
        // Report the line of the literal itself, so a multi-line call and the namespace rule agree on it.
        addReference(key, match.index + match[0].length - key.length - 2);
    }
    for (const match of text.matchAll(NAMESPACE_LITERAL_PATTERN)) {
        addReference(match[1], match.index);
    }
    for (const match of text.matchAll(DYNAMIC_KEY_PATTERN)) {
        const line = lineAt(text, match.index);
        dynamicCalls.push({ line, snippet: text.split('\n')[line - 1].trim() });
    }
    return { references: [...references.values()], dynamicCalls };
};

const run = () => {
    const localeKeys = Object.fromEntries(LOCALES.map((locale) => [locale, loadLocaleKeys(locale)]));
    const files = new Set();
    for (const entry of SCAN_SET) {
        collectSourceFiles(entry, files);
    }

    const findings = { missing: [], localeOnly: [], dynamic: [] };

    for (const file of files) {
        const displayPath = toDisplayPath(file);
        const { references, dynamicCalls } = collectReferences(file);
        for (const { key, line } of references.sort((a, b) => a.line - b.line)) {
            const missingIn = LOCALES.filter((locale) => !localeKeys[locale].has(key));
            if (missingIn.length > 0) {
                findings.missing.push(`missing-key ${displayPath}:${line} ${key} (missing in ${missingIn.join(', ')})`);
            }
        }
        for (const { line, snippet } of dynamicCalls) {
            findings.dynamic.push(`dynamic-key ${displayPath}:${line} ${snippet}`);
        }
    }

    for (const locale of LOCALES) {
        const others = LOCALES.filter((other) => other !== locale);
        for (const key of [...localeKeys[locale]].sort()) {
            const missingIn = others.filter((other) => !localeKeys[other].has(key));
            if (missingIn.length > 0) {
                findings.localeOnly.push(`locale-only ${key} (present in ${locale}, missing in ${missingIn.join(', ')})`);
            }
        }
    }

    const lines = [...findings.missing, ...findings.localeOnly, ...findings.dynamic];
    for (const line of lines) {
        console.log(line);
    }
    console.log(
        `i18n:check: ${lines.length} finding(s) in ${files.size} file(s) ` +
            `(missing-key ${findings.missing.length}, locale-only ${findings.localeOnly.length}, dynamic-key ${findings.dynamic.length})`,
    );
    return lines.length > 0 ? 1 : 0;
};

try {
    process.exitCode = run();
} catch (error) {
    console.error(`i18n:check: ${error.message}`);
    process.exitCode = 2;
}

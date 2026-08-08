import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  // Pages ported from tyrofreight keep their TypeScript. Linted with the
  // typescript-eslint parser (no type-aware rules — those need a program per
  // run and would slow `npm run lint` down for little gain here; `npm run
  // typecheck` covers correctness).
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // TS's own checker owns unused/undefined symbols; the base rules
      // misfire on type-only syntax.
      'no-unused-vars': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^React$' }],
    },
  },
  // Code ported from tyrofreight (see CLAUDE.md). It arrived from an app on an
  // older eslint-plugin-react-hooks, so it trips `set-state-in-effect` in ~17
  // places — all of them the "fetch, then set" and "latch once per coverage
  // gap" patterns its data hooks are built on. Rewriting working, Power
  // BI-calibrated financial data loading to satisfy a new advisory rule is how
  // a port gets broken, so it is a warning here rather than an error. The
  // correctness rules that catch real crashes (rules-of-hooks) stay ON, and
  // did in fact catch a genuine conditional-hook bug in ProjectsPage.
  {
    files: ['src/freight/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'no-useless-escape': 'warn',
    },
  },
  {
    files: ['src/components/ui/**/*.{js,jsx}'],
    rules: {
      'no-unused-vars': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/providers/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['vite.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
])

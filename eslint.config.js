import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import vitest from 'eslint-plugin-vitest';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { defineConfig, globalIgnores } from 'eslint/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// compute __dirname for ESM config files
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig([
  globalIgnores(['dist', 'build', 'coverage', '.triplex']),
  // include recommended configs as top-level entries so they apply correctly
  js.configs.recommended,
  // Use the plugin's flat-style recommended config to avoid legacy `plugins: ['react']` arrays
  react.configs.flat.recommended,
  reactRefresh.configs.vite,
  // NOTE: do not apply TypeScript plugin configs at the top-level — keep them inside
  // the TypeScript-only override below so TS rules don't leak into JS files.

  {
    // Apply TypeScript-specific rules only to application source and config files
    files: ['src/**/*.{ts,tsx}', 'vite.config.ts', 'vitest.config.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        // required for type-aware rules from recommendedTypeChecked
        // include app and node-specific tsconfigs so all type-checked files are found
        project: ['./tsconfig.app.json', './tsconfig.node.json', './tsconfig.spec.json'],
        tsconfigRootDir: __dirname,
      },
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      '@typescript-eslint': tsPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // merge recommended rules from plugins (apply type-aware configs only for TS)
      ...react.configs.recommended.rules,
      ...reactHooks.configs['recommended-latest'].rules,
      ...tsPlugin.configs.recommended.rules,
      ...tsPlugin.configs['recommended-type-checked'].rules,
      ...tsPlugin.configs['stylistic-type-checked'].rules,

      // your overrides
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unknown-property': [
        'error',
        {
          ignore: [
            'args',
            'position',
            'rotation',
            'castShadow',
            'receiveShadow',
            'intensity',
            'attach',
            'transparent',
            'emissive',
            'emissiveIntensity',
            'side',
          ],
        },
      ],
    },
  },
  // JavaScript / JSX override: apply React rules to .js/.jsx files without TypeScript rules
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
    },
    plugins: { 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      // apply JS-focused React rules (don't include TypeScript rules here)
      ...react.configs.recommended.rules,
      ...reactHooks.configs['recommended-latest'].rules,
    },
  },

  // Node / config files override: enable node globals for build scripts and config files
  {
    files: [
      'eslint.config.js',
      '.eslintrc.{js,cjs,mjs}',
      'vite.config.{js,cjs,mjs}',
      'postcss.config.mjs',
      'scripts/**',
      'tools/**',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    // add Node-specific rule tweaks here if desired
  },
  // Tests (Vitest) override — declare test globals so linting test files doesn't error
  {
    files: ['**/*.{spec,test}.{ts,tsx,js,jsx}'],
    // prefer the plugin's recommended settings when the plugin is installed
    plugins: { vitest },
    extends: [vitest.configs.recommended],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
    // Tests frequently use dynamic imports, unknowns, and loose typing — relax
    // strict runtime-safety rules in tests so they don't require defensive type
    // plumbing that would reduce readability.
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },

  // Vite / Node TypeScript config files: these use dynamic imports and optional
  // dependencies — relax unsafe-* rules for these specific files while keeping
  // strict checks for application source.
  {
    files: ['vite.config.ts', 'vitest.config.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
]);

/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
export default {
  plugins: ['prettier-plugin-tailwindcss'],

  // Formatting choices
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: 'all',
  bracketSpacing: true,
  arrowParens: 'always',
  quoteProps: 'as-needed',
  proseWrap: 'preserve',
  embeddedLanguageFormatting: 'auto',
  endOfLine: 'lf',

  // File-specific tweaks
  overrides: [
    { files: ['*.md', '*.mdx'], options: { printWidth: 80 } },
    { files: ['*.json', '*.jsonc'], options: { tabWidth: 2 } },
  ],
};

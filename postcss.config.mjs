// PostCSS configuration (ESM) — best-practice ordering for Tailwind + Radix
// - postcss-import runs first so any @import rules are resolved
// - tailwindcss/nesting provides nesting support and must run before Tailwind
// - tailwindcss processes utility & component generation
// - postcss-preset-env handles modern CSS polyfills (includes autoprefixer)
import postcssImport from 'postcss-import';
// Use the official CSS nesting plugin rather than importing an un-exported
// internal subpath from the Tailwind package (some Tailwind releases do not
// expose the `./nesting` subpath via package exports which breaks ESM
// resolution). This keeps nesting behavior consistent across environments.
import postcssNesting from 'postcss-nesting';
import tailwindcss from '@tailwindcss/postcss';
import postcssPresetEnv from 'postcss-preset-env';

export default {
  plugins: [
  postcssImport(),
  // Apply CSS nesting support (must run before Tailwind's processing so
  // nested rules are available when Tailwind generates utilities).
  postcssNesting(),
  tailwindcss(),
    postcssPresetEnv({
      // stage 3 enables a useful set of polyfills; adjust to your needs
      stage: 3,
      // disable nesting in preset-env because we're providing nesting via tailwindcss/nesting
      features: {
        'nesting-rules': false,
      },
    }),
  ],
};

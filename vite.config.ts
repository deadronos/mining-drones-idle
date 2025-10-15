import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Export an async config so we can conditionally add optional plugins
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const plugins: Plugin[] = [
    react({
      // keep the user's react-compiler babel plugin
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
      jsxRuntime: 'automatic',
    }) as unknown as Plugin,
  ];

  try {
    const tailwindcss = await import('@tailwindcss/vite');
    const tailwaindcssPluginCandidate = tailwindcss as unknown as {
      default?: unknown;
    };

    const tailwindccsPlugin = tailwaindcssPluginCandidate.default ?? tailwindcss;
    if (typeof tailwindccsPlugin === 'function') {
      const result = (tailwindccsPlugin as unknown as (...args: unknown[]) => Plugin | Plugin[])();
      if (Array.isArray(result)) plugins.push(...result);
      else plugins.push(result);
    }
  } catch {
    // no-op: plugin not installed
  }

  // Optionally add SVGR if installed (allows: import { ReactComponent as Icon } from './icon.svg')
  try {
    // vite-plugin-svgr usually exports a default function
    // dynamic import keeps this file safe if the plugin isn't installed
    // @ts-expect-error optional dependency may not be installed
    const svgr = await import('vite-plugin-svgr');
    // svgr may export default or be callable directly
    const svgrPluginCandidate = svgr as unknown as { default?: unknown };
    const svgrPlugin = svgrPluginCandidate.default ?? svgr;
    if (typeof svgrPlugin === 'function') {
      const result = (svgrPlugin as unknown as (...args: unknown[]) => Plugin | Plugin[])();
      if (Array.isArray(result)) plugins.push(...result);
      else plugins.push(result);
    }
  } catch {
    // no-op: plugin not installed
  }

  // Optionally add PWA support if the plugin is available
  try {
    // @ts-expect-error optional dependency may not be installed
    const pwa = await import('vite-plugin-pwa');
    const pwaMod = pwa as unknown as { VitePWA?: unknown; default?: unknown };
    const VitePWA = (pwaMod.VitePWA ?? pwaMod.default) as unknown;
    if (typeof VitePWA === 'function') {
      const result = (VitePWA as unknown as (...args: unknown[]) => Plugin | Plugin[])({
        registerType: 'autoUpdate',
        manifest: {
          name: 'React Vite Playground',
          short_name: 'RVP',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          icons: [],
        },
      });
      if (Array.isArray(result)) plugins.push(...result);
      else plugins.push(result);
    }
  } catch {
    // no-op: PWA plugin not installed
  }

  return {
    plugins,
    resolve: {
      alias: {
        // convenient alias to the src directory
        '@': path.resolve(__dirname, 'src'),
        '@triplex': path.resolve(__dirname, '.triplex'),
      },
    },
    server: {
      port: Number(env.VITE_PORT) || 5173,
      open: true,
      host: true,
      fs: {
        // allow serving files from project root
        allow: ['.'],
      },
    },
    build: {
      target: 'es2020',
      sourcemap: mode === 'development',
      // raise warning threshold for large chunks in playground repos
      chunkSizeWarningLimit: 2000,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'three'],
    },
    define: {
      // avoid runtime crashes when libs check process.env in browser code
      'process.env': {},
    },
  };
});

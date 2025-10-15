/// <reference types="vite/client" />
/// <reference types="vitest" />
// Minimal module shims for static assets and styles so TypeScript accepts
// imports like `import './globals.css'` and `import logo from './icon.svg'`.
declare module '*.svg' {
  const src: string;
  export default src;
}
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.webp';
declare module '*.gif';
declare module '*.css';
declare module '*.scss';
declare module '*.module.css';
declare module '*.module.scss';
